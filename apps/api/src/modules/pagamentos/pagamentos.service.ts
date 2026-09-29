// SPDX-License-Identifier: AGPL-3.0-or-later
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo, PagamentoStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { PIX_PROVIDER, PixProvider } from "./pix-provider";

@Injectable()
export class PagamentosService {
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

    await this.prisma.$transaction([
      this.prisma.pagamento.update({
        where: { id: reserva.pagamento.id },
        data: { status: PagamentoStatus.PAGO, pagoEm: new Date() },
      }),
      this.prisma.reserva.update({
        where: { id: reserva.id },
        data: { status: ReservaStatus.CONFIRMADA },
      }),
    ]);

    await this.avisarConfirmacao(reserva);

    return { status: PagamentoStatus.PAGO };
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
    });
  }
}
