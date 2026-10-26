// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PagamentoMetodo,
  PagamentoStatus,
  Prisma,
  ReservaOrigem,
  ReservaStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { contaDaReserva, motivoDaRecusa, type CupomParaAplicar } from "./cupom";
import { PagamentosService } from "../pagamentos/pagamentos.service";
import { QuadrasService } from "../quadras/quadras.service";
import { CreateReservaDto } from "./dto/create-reserva.dto";
import { estaDentroDoPrazo, garantirQueAceitaMudanca, limiteDoPrazo } from "./politica-reserva";
import { RemarcarReservaDto } from "./dto/remarcar-reserva.dto";

/** Como a reserva é devolvida ao app (traz quadra e estabelecimento juntos). */
const COM_CONTEXTO = {
  id: true,
  inicio: true,
  fim: true,
  status: true,
  preco: true,
  createdAt: true,
  canceladaEm: true,
  quadra: {
    select: {
      id: true,
      nome: true,
      fotos: true,
      modalidades: { select: { nome: true } },
      estabelecimento: {
        select: {
          id: true,
          nome: true,
          bairro: true,
          cidade: true,
          uf: true,
          timezone: true,
          cancelamentoHoras: true,
        },
      },
    },
  },
  pagamento: {
    select: {
      id: true,
      valor: true,
      metodo: true,
      status: true,
      pixCopiaCola: true,
      qrCodeUrl: true,
      expiraEm: true,
    },
  },
} satisfies Prisma.ReservaSelect;

/**
 * A corrida por um mesmo horário estoura no banco, não na aplicação.
 *
 * Com o índice único era um `P2002` limpo. Com a exclusion constraint o
 * Postgres levanta 23P01 (`exclusion_violation`), que o Prisma ainda não
 * mapeia para um código próprio — sobra reconhecer a constraint pelo nome.
 * O `P2002` fica no teste para cobrir bancos que ainda não receberam a
 * migração.
 */
/**
 * Se o erro é a restrição que segura o limite de usos do cupom (RN-14).
 *
 * Reconhecida pelo nome, como a de sobreposição: o Prisma devolve violação
 * de CHECK como erro genérico de restrição, e tratar todo erro genérico como
 * "cupom esgotado" esconderia falha de banco atrás de uma mensagem que culpa
 * o cliente.
 */
export function ehCupomEsgotado(erro: unknown): boolean {
  return erro instanceof Error && erro.message.includes("promocao_usos_dentro_do_limite");
}

export function ehConflitoDeHorario(erro: unknown): boolean {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    return true;
  }
  return erro instanceof Error && erro.message.includes("reserva_sem_sobreposicao");
}

/**
 * Se o erro é **impasse** entre transações que disputam o mesmo horário
 * (SQLSTATE `40P01`, `deadlock detected`).
 *
 * **Não é a mesma coisa que conflito de horário, e a diferença importa.** A
 * violação da restrição de exclusão é prova de que o intervalo está ocupado.
 * O impasse não prova nada sobre o intervalo: prova que esta transação perdeu
 * a disputa e foi abortada pelo banco para desfazer um ciclo de espera.
 *
 * Quem espera pela `EXCLUDE USING gist` toma um `ShareLock` na transação que
 * está inserindo, e com várias tentativas simultâneas pelo mesmo intervalo o
 * PostgreSQL acha um ciclo entre as esperas e aborta uma delas com `40P01`
 * em vez de `23P01`. Medido nesta máquina em 22/10/2026, com o portão de
 * carga do RNF-03: em cerca de uma execução em cinco, uma das dezenove
 * derrotas chegava como impasse.
 *
 * O efeito de não reconhecê-lo era o cliente receber **500 em vez de 409**
 * por ter disputado um horário — e a falha aparecia no portão como
 * `Expected: true, Received: false`, que não nomeia erro nenhum e por isso
 * passava por instabilidade.
 *
 * **O discriminador é o SQLSTATE, não a frase.** A mensagem do servidor vem
 * no idioma dele: aqui ela chega como *"impasse detectado"*. É a mesma lição
 * que a suíte de integração do mensalista já registra sobre o `23P01`.
 */
export function ehImpasseDeHorario(erro: unknown): boolean {
  return erro instanceof Error && /\b40P01\b/.test(erro.message);
}

/**
 * A recusa que o cliente vê quando perdeu a disputa sem que se possa afirmar
 * que o horário está tomado.
 *
 * Dizer "esse horário já tem reserva" num impasse seria afirmar o que não se
 * mediu; dizer para tentar de novo é verdadeiro e acionável, porque a
 * segunda tentativa encontra o intervalo decidido.
 */
export const HORARIO_DISPUTADO = "Esse horário está sendo disputado neste instante. Tente de novo.";

/**
 * Executa a escrita e, se o banco abortar por **impasse**, repete uma vez.
 *
 * **Repetir é seguro aqui por definição, e não por otimismo.** O `40P01` é o
 * jeito de o PostgreSQL desfazer um ciclo de espera: ele escolhe uma
 * transação e a aborta **inteira**. Nada daquela tentativa ficou no banco, de
 * modo que a segunda começa do mesmo lugar que a primeira — não há escrita
 * parcial para compensar, nem incremento de cupom a desfazer, porque o que se
 * repete é a transação, e não uma parte dela.
 *
 * **Uma vez, e não até dar certo.** A primeira tentativa perdeu a disputa; na
 * segunda o intervalo já está decidido, e o resultado é definitivo: ou a
 * reserva nasce, ou a restrição de exclusão a recusa com `23P01` e o cliente
 * recebe 409 com a mensagem que corresponde ao que de fato aconteceu. Repetir
 * em laço trocaria uma recusa honesta por espera indefinida, e esconderia
 * contenção sistêmica, que é informação que o projeto quer ver.
 *
 * O que isto corrige é a **nondeterminância da resposta**: sem a repetição, o
 * mesmo cliente, na mesma disputa, recebia 409 ou a recusa por impasse
 * conforme a transação que o banco escolhesse abortar.
 */
export async function semImpasse<T>(escrever: () => Promise<T>): Promise<T> {
  try {
    return await escrever();
  } catch (erro) {
    if (!ehImpasseDeHorario(erro)) throw erro;
    return await escrever();
  }
}

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quadras: QuadrasService,
    private readonly pagamentos: PagamentosService,
  ) {}

  /** Reservas do cliente logado (tela "Minhas reservas"). */
  async minhas(usuarioId: string) {
    const reservas = await this.prisma.reserva.findMany({
      where: { clienteId: usuarioId, status: { not: ReservaStatus.BLOQUEIO } },
      select: COM_CONTEXTO,
      orderBy: { inicio: "desc" },
      take: 50,
    });
    return reservas.map((r) => this.paraDto(r));
  }

  async detalhe(id: string, usuarioId: string) {
    const reserva = await this.prisma.reserva.findFirst({
      where: { id, clienteId: usuarioId },
      select: COM_CONTEXTO,
    });
    if (!reserva) {
      throw new NotFoundException("Reserva não encontrada.");
    }
    return this.paraDto(reserva);
  }

  /**
   * Abre uma reserva com a cobrança correspondente (RF-08, RN-01).
   *
   * O horário é revalidado contra a mesma grade que o app consultou — nada de
   * confiar no preço vindo do cliente. A corrida entre dois clientes pedindo o
   * mesmo slot é resolvida **no banco**, pela exclusion constraint
   * `reserva_sem_sobreposicao`: quem perde recebe 409 em vez de gerar
   * overbooking.
   *
   * A checagem de `slot.disponivel` acima não é a trava — entre ela e o INSERT
   * existe uma janela na qual outra transação insere. Por isso a garantia mora
   * no armazenamento, e não aqui.
   */
  async criar(dto: CreateReservaDto, usuarioId: string) {
    const inicio = new Date(dto.inicio);
    const fim = new Date(dto.fim);
    if (!(fim > inicio)) {
      throw new BadRequestException("O fim deve ser depois do início.");
    }

    const quadra = await this.prisma.quadra.findFirst({
      where: { id: dto.quadraId, ativo: true },
      select: {
        id: true,
        nome: true,
        estabelecimentoId: true,
        estabelecimento: {
          select: {
            nome: true,
            timezone: true,
            descontoPixPct: true,
            cuponsAcumulam: true,
            pixExpiraMinutos: true,
          },
        },
      },
    });
    if (!quadra) {
      throw new NotFoundException("Quadra não encontrada.");
    }

    const est = quadra.estabelecimento;
    const dataLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: est.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(inicio);

    const { slots } = await this.quadras.disponibilidade(quadra.id, dataLocal);
    const slot = slots.find(
      (s) =>
        new Date(s.inicio).getTime() === inicio.getTime() &&
        new Date(s.fim).getTime() === fim.getTime(),
    );
    if (!slot) {
      throw new BadRequestException("Horário fora da grade da quadra.");
    }
    if (!slot.disponivel) {
      throw new ConflictException("Horário indisponível.");
    }

    const metodo = dto.metodo ?? PagamentoMetodo.PIX;
    const descontoPixPct = metodo === PagamentoMetodo.PIX ? Number(est.descontoPixPct) : 0;

    const cupom = dto.cupom
      ? await this.acharCupom(quadra.estabelecimentoId, dto.cupom)
      : undefined;
    const { valor } = contaDaReserva({
      precoBruto: slot.preco,
      descontoPixPct,
      cupom: cupom?.regra,
      acumulam: est.cuponsAcumulam,
    });

    let reserva;
    try {
      // Transação porque o uso do cupom e a reserva têm de nascer juntos: um
      // contador adiantado sem reserva tiraria do ar um uso que ninguém
      // aproveitou, e uma reserva com cupom não contabilizado fura o limite.
      // O `semImpasse` repete a transação **inteira** quando o banco a
      // aborta por `40P01`: é por ela ser a unidade de atomicidade que a
      // repetição não deixa incremento de cupom pendurado.
      reserva = await semImpasse(() =>
        this.prisma.$transaction(async (tx) => {
          if (cupom) {
            // Quem garante o limite é a restrição `promocao_usos_dentro_do_limite`:
            // entre a conferência acima e esta escrita cabe outra requisição
            // usando o último uso.
            await tx.promocao.update({
              where: { id: cupom.id },
              data: { usosFeitos: { increment: 1 } },
            });
          }
          return tx.reserva.create({
            data: {
              estabelecimentoId: quadra.estabelecimentoId,
              quadraId: quadra.id,
              clienteId: usuarioId,
              inicio,
              fim,
              preco: new Prisma.Decimal(slot.preco),
              status: ReservaStatus.PENDENTE_PAGAMENTO,
              origem: ReservaOrigem.APP,
              promocaoId: cupom?.id,
              pagamento: {
                create: {
                  valor: new Prisma.Decimal(valor),
                  metodo,
                  status: PagamentoStatus.PENDENTE,
                },
              },
            },
            select: { id: true },
          });
        }),
      );
    } catch (erro) {
      if (ehConflitoDeHorario(erro)) {
        throw new ConflictException("Esse horário acabou de ser reservado.");
      }
      if (ehImpasseDeHorario(erro)) {
        throw new ConflictException(HORARIO_DISPUTADO);
      }
      if (ehCupomEsgotado(erro)) {
        throw new ConflictException("Esse cupom acabou de atingir o limite de usos.");
      }
      throw erro;
    }

    if (metodo === PagamentoMetodo.PIX) {
      const cobranca = await this.pagamentos.criarCobrancaPix({
        reservaId: reserva.id,
        valor,
        descricao: `${est.nome} · ${quadra.nome}`,
        expiraEmMinutos: est.pixExpiraMinutos,
      });
      await this.prisma.pagamento.update({
        where: { reservaId: reserva.id },
        data: {
          gatewayId: cobranca.gatewayId,
          pixCopiaCola: cobranca.copiaCola,
          qrCodeUrl: cobranca.qrCodeUrl,
          expiraEm: cobranca.expiraEm,
        },
      });
    }

    return this.detalhe(reserva.id, usuarioId);
  }

  /**
   * Acha o cupom do estabelecimento e recusa com o motivo (RF-14, RN-14).
   *
   * Busca sem diferenciar maiúscula de minúscula: ninguém digita cupom com o
   * cuidado de uma senha, e recusar "primeira10" por causa da caixa seria
   * inventar um obstáculo que a regra não pede.
   *
   * O cupom é procurado **dentro do estabelecimento da quadra** — um código
   * de uma arena não vale em outra, mesmo que o texto coincida.
   */
  private async acharCupom(estabelecimentoId: string, codigo: string) {
    const achado = await this.prisma.promocao.findFirst({
      where: {
        estabelecimentoId,
        codigo: { equals: codigo.trim(), mode: "insensitive" },
      },
      select: {
        id: true,
        codigo: true,
        tipo: true,
        valor: true,
        validadeInicio: true,
        validadeFim: true,
        usosMax: true,
        usosFeitos: true,
        ativo: true,
      },
    });
    if (!achado) {
      throw new NotFoundException("Cupom não encontrado para esta arena.");
    }

    const regra: CupomParaAplicar = { ...achado, valor: Number(achado.valor) };
    const recusa = motivoDaRecusa(regra, new Date());
    if (recusa) throw new ConflictException(recusa);

    return { id: achado.id, regra };
  }

  /**
   * Cancela uma reserva do cliente (RF-09, RN-02).
   *
   * A janela de `cancelamentoHoras` do estabelecimento não decide *se* dá para
   * cancelar, e sim se o cancelamento é **no prazo**: fora dele o cliente
   * ainda libera o slot, mas sem direito a devolução. O estorno em si é o
   * RF-15 e ainda não existe — por isso devolvemos `dentroDoPrazo`, que é um
   * fato, em vez de prometer reembolso.
   */
  async cancelar(id: string, usuarioId: string, motivo?: string) {
    const reserva = await this.prisma.reserva.findFirst({
      where: { id, clienteId: usuarioId },
      select: {
        id: true,
        inicio: true,
        status: true,
        quadra: {
          select: { estabelecimento: { select: { cancelamentoHoras: true } } },
        },
        pagamento: { select: { id: true, status: true } },
      },
    });
    if (!reserva) {
      throw new NotFoundException("Reserva não encontrada.");
    }
    const agora = new Date();
    garantirQueAceitaMudanca(reserva, agora, "cancelada");

    const dentroDoPrazo = estaDentroDoPrazo(
      reserva.inicio,
      reserva.quadra.estabelecimento.cancelamentoHoras,
      agora,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.reserva.update({
        where: { id: reserva.id },
        data: {
          status: ReservaStatus.CANCELADA,
          canceladaEm: agora,
          motivoCancelamento: motivo?.trim() || "Cancelada pelo cliente",
        },
      });
      // A cobrança em aberto morre junto: sem isto o app continuaria
      // oferecendo "pagar" numa reserva que não existe mais. Um status
      // próprio (CANCELADO) diria melhor que EXPIRADO, mas pede migração.
      if (reserva.pagamento?.status === PagamentoStatus.PENDENTE) {
        await tx.pagamento.update({
          where: { id: reserva.pagamento.id },
          data: { status: PagamentoStatus.EXPIRADO },
        });
      }
    });

    return { ...(await this.detalhe(id, usuarioId)), dentroDoPrazo };
  }

  /**
   * Move a reserva para outro horário (RF-09).
   *
   * Remarcar só vale **dentro da janela de cancelamento** (RN-02), e não por
   * capricho: se desse para remarcar fora do prazo, a política não valeria
   * nada — bastava empurrar a reserva para daqui a um mês, onde a janela
   * volta a estar aberta, e cancelar de graça.
   *
   * O horário novo é revalidado contra a mesma grade que o app consultou e o
   * preço é recalculado pela faixa do novo slot. Se a reserva já está paga e o
   * preço muda, a remarcação é recusada: devolver ou cobrar a diferença é
   * RF-14/RF-15 e ainda não existe.
   */
  async remarcar(id: string, usuarioId: string, dto: RemarcarReservaDto) {
    const inicio = new Date(dto.inicio);
    const fim = new Date(dto.fim);
    if (!(fim > inicio)) {
      throw new BadRequestException("O fim deve ser depois do início.");
    }

    const reserva = await this.prisma.reserva.findFirst({
      where: { id, clienteId: usuarioId },
      select: {
        id: true,
        inicio: true,
        fim: true,
        status: true,
        quadraId: true,
        quadra: {
          select: {
            nome: true,
            estabelecimento: {
              select: {
                nome: true,
                timezone: true,
                cancelamentoHoras: true,
                descontoPixPct: true,
                pixExpiraMinutos: true,
              },
            },
          },
        },
        pagamento: {
          select: { id: true, status: true, metodo: true, valor: true },
        },
      },
    });
    if (!reserva) {
      throw new NotFoundException("Reserva não encontrada.");
    }
    const agora = new Date();
    garantirQueAceitaMudanca(reserva, agora, "remarcada");

    if (reserva.inicio.getTime() === inicio.getTime() && reserva.fim.getTime() === fim.getTime()) {
      throw new BadRequestException("A reserva já está nesse horário.");
    }

    const est = reserva.quadra.estabelecimento;
    const horas = est.cancelamentoHoras;
    if (!estaDentroDoPrazo(reserva.inicio, horas, agora)) {
      throw new ConflictException(`A remarcação vale até ${horas} h antes do horário.`);
    }

    const dataLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: est.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(inicio);
    const { slots } = await this.quadras.disponibilidade(reserva.quadraId, dataLocal);
    const slot = slots.find(
      (s) =>
        new Date(s.inicio).getTime() === inicio.getTime() &&
        new Date(s.fim).getTime() === fim.getTime(),
    );
    if (!slot) {
      throw new BadRequestException("Horário fora da grade da quadra.");
    }
    if (!slot.disponivel) {
      throw new ConflictException("Horário indisponível.");
    }

    const pagamento = reserva.pagamento;
    const jaPago = pagamento?.status === PagamentoStatus.PAGO;
    const desconto = pagamento?.metodo === PagamentoMetodo.PIX ? Number(est.descontoPixPct) : 0;
    const novoValor = Number((slot.preco * (1 - desconto / 100)).toFixed(2));

    if (jaPago && Number(pagamento.valor) !== novoValor) {
      throw new ConflictException(
        "O novo horário tem preço diferente. Cancele e faça uma nova reserva.",
      );
    }

    try {
      await semImpasse(() =>
        this.prisma.reserva.update({
          where: { id: reserva.id },
          data: { inicio, fim, preco: new Prisma.Decimal(slot.preco) },
        }),
      );
    } catch (erro) {
      if (ehConflitoDeHorario(erro)) {
        throw new ConflictException("Esse horário acabou de ser reservado.");
      }
      if (ehImpasseDeHorario(erro)) {
        throw new ConflictException(HORARIO_DISPUTADO);
      }
      throw erro;
    }

    // O BR Code carrega o valor dentro dele, então mudar de preço obriga a
    // emitir outra cobrança — a antiga cobraria o valor errado.
    if (pagamento && !jaPago && Number(pagamento.valor) !== novoValor) {
      const dados: Prisma.PagamentoUpdateInput = {
        valor: new Prisma.Decimal(novoValor),
      };
      if (pagamento.metodo === PagamentoMetodo.PIX) {
        const cobranca = await this.pagamentos.criarCobrancaPix({
          reservaId: reserva.id,
          valor: novoValor,
          descricao: `${est.nome} · ${reserva.quadra.nome}`,
          expiraEmMinutos: est.pixExpiraMinutos,
        });
        dados.gatewayId = cobranca.gatewayId;
        dados.pixCopiaCola = cobranca.copiaCola;
        dados.qrCodeUrl = cobranca.qrCodeUrl;
        dados.expiraEm = cobranca.expiraEm;
      }
      await this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: dados,
      });
    }

    return this.detalhe(id, usuarioId);
  }

  private paraDto(r: {
    id: string;
    inicio: Date;
    fim: Date;
    status: ReservaStatus;
    preco: Prisma.Decimal;
    createdAt: Date;
    canceladaEm: Date | null;
    quadra: {
      id: string;
      nome: string;
      fotos: string[];
      modalidades: { nome: string }[];
      estabelecimento: {
        id: string;
        nome: string;
        bairro: string | null;
        cidade: string | null;
        uf: string | null;
        timezone: string;
        cancelamentoHoras: number;
      };
    };
    pagamento: {
      id: string;
      valor: Prisma.Decimal;
      metodo: PagamentoMetodo;
      status: PagamentoStatus;
      pixCopiaCola: string | null;
      qrCodeUrl: string | null;
      expiraEm: Date | null;
    } | null;
  }) {
    const tz = r.quadra.estabelecimento.timezone;
    const hora = (quando: Date) =>
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }).format(quando);

    const est = r.quadra.estabelecimento;
    const agora = new Date();
    const gratuitoAte = limiteDoPrazo(r.inicio, est.cancelamentoHoras);
    const ativa =
      r.status === ReservaStatus.PENDENTE_PAGAMENTO || r.status === ReservaStatus.CONFIRMADA;

    return {
      id: r.id,
      // Código curto e legível, como no comprovante do Figma (#RALLY-7K2P).
      codigo: `RALLY-${r.id.slice(-4).toUpperCase()}`,
      inicio: r.inicio.toISOString(),
      fim: r.fim.toISOString(),
      horaInicio: hora(r.inicio),
      horaFim: hora(r.fim),
      status: r.status,
      preco: Number(r.preco),
      criadaEm: r.createdAt.toISOString(),
      canceladaEm: r.canceladaEm?.toISOString() ?? null,
      cancelavel: ativa && r.inicio > agora,
      cancelamentoHoras: est.cancelamentoHoras,
      cancelamentoGratuitoAte: gratuitoAte.toISOString(),
      cancelamentoGratuito: ativa && agora <= gratuitoAte,
      quadra: {
        id: r.quadra.id,
        nome: r.quadra.nome,
        fotos: r.quadra.fotos,
        modalidades: r.quadra.modalidades.map((m) => m.nome),
        estabelecimento: r.quadra.estabelecimento,
      },
      pagamento: r.pagamento ? { ...r.pagamento, valor: Number(r.pagamento.valor) } : null,
    };
  }
}
