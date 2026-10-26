// SPDX-License-Identifier: AGPL-3.0-or-later
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo, PagamentoStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { EVENTOS_TRATADOS } from "./dto/evento-de-pagamento.dto";
import { PIX_PROVIDER, PixProvider } from "./pix-provider";

/** O que o webhook devolve ao gateway, e o que cada campo quer dizer. */
export type ResultadoDoEvento = {
  /** A transição foi aplicada **por esta chamada**. */
  aplicado: boolean;
  /** O pagamento já estava no estado final antes desta chamada. */
  jaEstavaPago?: boolean;
  /** A reserva foi confirmada junto. Falso quando ela já não estava de pé. */
  reservaConfirmada?: boolean;
  /** Por que nada foi feito, quando nada foi feito. */
  motivo?: string;
};

@Injectable()
export class PagamentosService {
  private readonly log = new Logger(PagamentosService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PIX_PROVIDER) private readonly pix: PixProvider,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /** Cria a cobrança Pix de uma reserva recém-aberta. */
  criarCobrancaPix(input: {
    reservaId: string;
    valor: number;
    descricao: string;
    expiraEmMinutos: number;
  }) {
    return this.pix.criarCobranca(input);
  }

  /**
   * Confirmação manual **apenas em desenvolvimento**: faz o papel do webhook
   * do gateway para dar para testar o fluxo do app ponta a ponta.
   */
  async simularPagamento(reservaId: string, usuarioId: string) {
    if (process.env.NODE_ENV === "production") {
      throw new ForbiddenException("Confirmação simulada indisponível em produção.");
    }

    const reserva = await this.prisma.reserva.findUnique({
      where: { id: reservaId },
      select: {
        id: true,
        clienteId: true,
        inicio: true,
        pagamento: { select: { id: true } },
        quadra: {
          select: {
            nome: true,
            estabelecimento: { select: { nome: true, timezone: true } },
          },
        },
      },
    });
    if (!reserva || !reserva.pagamento) {
      throw new NotFoundException("Reserva ou pagamento não encontrado.");
    }
    if (reserva.clienteId !== usuarioId) {
      throw new ForbiddenException("Reserva de outro cliente.");
    }

    // **Passa pela mesma transição do webhook, de propósito.** Antes havia
    // dois caminhos para confirmar um pagamento — este e o que o gateway
    // usaria —, e eles teriam divergido: o de desenvolvimento confirmava a
    // reserva incondicionalmente, inclusive uma já cancelada. Um caminho só
    // significa que o que eu exercito no app é o que o gateway executa.
    const resultado = await this.marcarPago(reserva.pagamento.id, reserva);
    return { status: PagamentoStatus.PAGO, ...resultado };
  }

  /**
   * Aplica um evento do gateway de pagamento (RNF-10).
   *
   * **A idempotência é a razão de esta rota existir separada.** Gateway
   * reentrega quando não recebe 2xx — e reentrega também quando recebeu e o
   * 2xx se perdeu no caminho. Confirmar duas vezes não estraga o estado, que
   * já é final, mas **manda dois e-mails de "pagamento confirmado"** para a
   * mesma pessoa, e é isso que o cliente percebe.
   */
  async aplicarEvento(dto: {
    gatewayId: string;
    evento: string;
    eventoId?: string;
  }): Promise<ResultadoDoEvento> {
    if (!EVENTOS_TRATADOS.includes(dto.evento as (typeof EVENTOS_TRATADOS)[number])) {
      // 200 e não 4xx: 4xx faria o gateway reentregar para sempre ou marcar
      // a entrega como falha permanente, e nenhum dos dois é o que queremos
      // dizer. Queremos dizer "recebi, não se aplica".
      this.log.log(`Evento de pagamento ignorado: ${dto.evento}`);
      return { aplicado: false, motivo: `evento não tratado: ${dto.evento}` };
    }

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { gatewayId: dto.gatewayId },
      select: {
        id: true,
        reserva: {
          select: {
            id: true,
            clienteId: true,
            inicio: true,
            quadra: {
              select: {
                nome: true,
                estabelecimento: { select: { nome: true, timezone: true } },
              },
            },
          },
        },
      },
    });

    // **404, e dá para provar que é seguro.** O `gatewayId` é gravado antes
    // de o copia e cola chegar ao cliente (`ReservasService.criar` espera o
    // `update` antes de devolver o detalhe), de modo que ninguém consegue
    // pagar um código que ainda não recebeu: não existe janela em que o
    // evento chegue antes do registro. Cobrança desconhecida aqui é cobrança
    // de outra conta ou configuração errada, e as duas devem falhar alto em
    // vez de virar um 200 que esconde o problema.
    if (!pagamento) {
      this.log.warn(
        `Evento ${dto.evento} para cobrança desconhecida ${dto.gatewayId}` +
          (dto.eventoId ? ` (evento ${dto.eventoId})` : ""),
      );
      throw new NotFoundException("Cobrança não encontrada.");
    }

    return this.marcarPago(pagamento.id, pagamento.reserva);
  }

  /**
   * A transição "pagamento vira pago", executada **no máximo uma vez**.
   *
   * O mecanismo é o mesmo do projeto inteiro: em vez de ler o estado e
   * decidir — o que abre a janela entre a leitura e a escrita —, a condição
   * vai **dentro do `where`**, e o banco diz quantas linhas mudaram.
   * `count === 1` significa "esta chamada fez a transição"; `count === 0`
   * significa que outra já tinha feito. Só quem fez executa os efeitos.
   */
  private async marcarPago(
    pagamentoId: string,
    reserva: {
      id: string;
      clienteId: string | null;
      inicio: Date;
      quadra: { nome: string; estabelecimento: { nome: string; timezone: string } };
    },
  ): Promise<ResultadoDoEvento> {
    const { ganhou, confirmou } = await this.prisma.$transaction(async (tx) => {
      const marcado = await tx.pagamento.updateMany({
        where: { id: pagamentoId, pagoEm: null },
        data: { status: PagamentoStatus.PAGO, pagoEm: new Date() },
      });
      if (marcado.count === 0) return { ganhou: false, confirmou: false };

      // **A reserva só é confirmada se ainda estiver de pé.** Pagar uma
      // reserva já cancelada acontece de verdade: o Pix expirou, o horário
      // foi liberado e vendido para outra pessoa, e o pagamento cai depois.
      // Ressuscitar a reserva aqui criaria duas reservas no mesmo horário —
      // e a restrição de exclusão do banco recusaria, derrubando o webhook.
      // O pagamento fica registrado como pago, a reserva fica cancelada, e a
      // **conciliação já enxerga esse par** como a divergência `CANCELADA_PAGA`,
      // que é do dono resolver com estorno.
      const confirmada = await tx.reserva.updateMany({
        where: { id: reserva.id, status: ReservaStatus.PENDENTE_PAGAMENTO },
        data: { status: ReservaStatus.CONFIRMADA },
      });
      return { ganhou: true, confirmou: confirmada.count === 1 };
    });

    if (!ganhou) return { aplicado: false, jaEstavaPago: true };

    if (!confirmou) {
      this.log.warn(
        `Pagamento ${pagamentoId} confirmado sobre reserva ${reserva.id} que ` +
          `não estava pendente. Aparece na conciliação como CANCELADA_PAGA.`,
      );
      return {
        aplicado: true,
        reservaConfirmada: false,
        motivo: "reserva não estava pendente de pagamento",
      };
    }

    await this.avisarConfirmacao(reserva);
    return { aplicado: true, reservaConfirmada: true };
  }

  /**
   * Avisa o cliente de que a reserva foi confirmada (RF-16).
   *
   * Fica depois da transação de propósito: o aviso é consequência do
   * pagamento, não condição dele.
   */
  private avisarConfirmacao(reserva: {
    id: string;
    clienteId: string | null;
    inicio: Date;
    quadra: { nome: string; estabelecimento: { nome: string; timezone: string } };
  }) {
    if (!reserva.clienteId) return Promise.resolve();

    const est = reserva.quadra.estabelecimento;
    const quando = new Intl.DateTimeFormat("pt-BR", {
      timeZone: est.timezone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(reserva.inicio);

    return this.notificacoes.registrar({
      usuarioId: reserva.clienteId,
      tipo: NotificacaoTipo.PAGAMENTO,
      titulo: "Pagamento confirmado",
      corpo: `${est.nome} · ${reserva.quadra.nome} — ${quando}`,
      destino: `/reservas/${reserva.id}/confirmacao`,
      // Comprovante de pagamento é o aviso que mais justifica sair do
      // aplicativo: é o que a pessoa procura depois, e procura no e-mail.
      email: {
        assunto: `Pagamento confirmado — ${est.nome}`,
        texto:
          `Seu pagamento foi confirmado.\n\n` +
          `Local: ${est.nome}\n` +
          `Quadra: ${reserva.quadra.nome}\n` +
          `Horário: ${quando}\n\n` +
          `Bom jogo!`,
      },
    });
  }
}
