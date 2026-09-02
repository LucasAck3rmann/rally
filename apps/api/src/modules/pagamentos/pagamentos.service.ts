// SPDX-License-Identifier: AGPL-3.0-or-later
import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PagamentoStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PIX_PROVIDER, PixProvider } from "./pix-provider";

@Injectable()
export class PagamentosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PIX_PROVIDER) private readonly pix: PixProvider,
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
      select: { id: true, clienteId: true, pagamento: { select: { id: true } } },
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

    return { status: PagamentoStatus.PAGO };
  }
}
