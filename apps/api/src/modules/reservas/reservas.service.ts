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
import { PagamentosService } from "../pagamentos/pagamentos.service";
import { QuadrasService } from "../quadras/quadras.service";
import { CreateReservaDto } from "./dto/create-reserva.dto";

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
export function ehConflitoDeHorario(erro: unknown): boolean {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return true;
  }
  return (
    erro instanceof Error && erro.message.includes("reserva_sem_sobreposicao")
  );
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
   * mesmo slot é resolvida pelo índice único `(quadraId, inicio)`: quem perde
   * recebe 409 em vez de gerar overbooking.
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
    const desconto = metodo === PagamentoMetodo.PIX ? Number(est.descontoPixPct) : 0;
    const valor = Number((slot.preco * (1 - desconto / 100)).toFixed(2));

    let reserva;
    try {
      reserva = await this.prisma.reserva.create({
        data: {
          estabelecimentoId: quadra.estabelecimentoId,
          quadraId: quadra.id,
          clienteId: usuarioId,
          inicio,
          fim,
          preco: new Prisma.Decimal(slot.preco),
          status: ReservaStatus.PENDENTE_PAGAMENTO,
          origem: ReservaOrigem.APP,
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
    } catch (erro) {
      if (ehConflitoDeHorario(erro)) {
        throw new ConflictException("Esse horário acabou de ser reservado.");
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
    if (reserva.status === ReservaStatus.CANCELADA) {
      throw new ConflictException("Esta reserva já foi cancelada.");
    }
    if (
      reserva.status !== ReservaStatus.PENDENTE_PAGAMENTO &&
      reserva.status !== ReservaStatus.CONFIRMADA
    ) {
      throw new ConflictException("Esta reserva não pode mais ser cancelada.");
    }

    const agora = new Date();
    if (reserva.inicio <= agora) {
      throw new ConflictException("O horário da reserva já começou.");
    }

    const horas = reserva.quadra.estabelecimento.cancelamentoHoras;
    const dentroDoPrazo =
      agora <= new Date(reserva.inicio.getTime() - horas * 60 * 60 * 1000);

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
    const gratuitoAte = new Date(
      r.inicio.getTime() - est.cancelamentoHoras * 60 * 60 * 1000,
    );
    const ativa =
      r.status === ReservaStatus.PENDENTE_PAGAMENTO ||
      r.status === ReservaStatus.CONFIRMADA;

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
