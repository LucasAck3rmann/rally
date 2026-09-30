// SPDX-License-Identifier: AGPL-3.0-or-later
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo, PagamentoStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { PagamentosService } from "./pagamentos.service";
import { PixProvider } from "./pix-provider";

/** 02/10/2026 às 08:00 em São Paulo (UTC-3). */
const INICIO = new Date("2026-10-02T11:00:00.000Z");

function reservaBase(extras: Record<string, unknown> = {}) {
  return {
    id: "r1",
    clienteId: "u1",
    inicio: INICIO,
    pagamento: { id: "p1" },
    quadra: {
      nome: "Quadra 1",
      estabelecimento: {
        nome: "Arena Beach Sapiranga",
        timezone: "America/Sao_Paulo",
      },
    },
    ...extras,
  };
}

function servico(reserva: unknown) {
  const atualizaPagamento = jest.fn().mockReturnValue("op-pagamento");
  const atualizaReserva = jest.fn().mockReturnValue("op-reserva");
  const transacao = jest.fn().mockResolvedValue([]);
  const registrar = jest.fn().mockResolvedValue(undefined);
  const criarCobranca = jest.fn().mockResolvedValue({ gatewayId: "g1" });

  const prisma = {
    reserva: {
      findUnique: jest.fn().mockResolvedValue(reserva),
      update: atualizaReserva,
    },
    pagamento: { update: atualizaPagamento },
    $transaction: transacao,
  } as unknown as PrismaService;

  const servico = new PagamentosService(
    prisma,
    { criarCobranca } as unknown as PixProvider,
    { registrar } as unknown as NotificacoesService,
  );
  return { servico, atualizaPagamento, atualizaReserva, transacao, registrar, criarCobranca };
}

describe("PagamentosService", () => {
  const ambienteOriginal = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ambienteOriginal;
  });

  describe("criarCobrancaPix", () => {
    it("delega ao provedor configurado", async () => {
      const { servico: s, criarCobranca } = servico(reservaBase());

      await s.criarCobrancaPix({
        reservaId: "r1",
        valor: 76,
        descricao: "Arena · Quadra 1",
        expiraEmMinutos: 30,
      });

      // A porta é o que permite trocar o provedor de desenvolvimento pela
      // AbacatePay sem tocar no domínio (ADR-0003).
      expect(criarCobranca).toHaveBeenCalledWith(
        expect.objectContaining({ reservaId: "r1", valor: 76 }),
      );
    });
  });

  describe("simularPagamento", () => {
    it("é bloqueado em produção", async () => {
      process.env.NODE_ENV = "production";
      const { servico: s, transacao } = servico(reservaBase());

      await expect(s.simularPagamento("r1", "u1")).rejects.toThrow(
        ForbiddenException,
      );
      // O corte vem antes de qualquer escrita: em produção quem confirma é o
      // webhook do gateway, nunca uma chamada do app.
      expect(transacao).not.toHaveBeenCalled();
    });

    it("recusa reserva inexistente", async () => {
      const { servico: s } = servico(null);

      await expect(s.simularPagamento("r1", "u1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("recusa reserva sem cobrança", async () => {
      const { servico: s } = servico(reservaBase({ pagamento: null }));

      await expect(s.simularPagamento("r1", "u1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("recusa confirmar a reserva de outro cliente", async () => {
      const { servico: s, transacao } = servico(reservaBase());

      await expect(s.simularPagamento("r1", "outro")).rejects.toThrow(
        ForbiddenException,
      );
      expect(transacao).not.toHaveBeenCalled();
    });

    it("marca a cobrança como paga e a reserva como confirmada, na mesma transação", async () => {
      const { servico: s, atualizaPagamento, atualizaReserva, transacao } =
        servico(reservaBase());

      const saida = await s.simularPagamento("r1", "u1");

      expect(saida).toEqual({ status: PagamentoStatus.PAGO });
      expect(atualizaPagamento).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1" },
          data: expect.objectContaining({ status: PagamentoStatus.PAGO }),
        }),
      );
      expect(atualizaReserva).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r1" },
          data: { status: ReservaStatus.CONFIRMADA },
        }),
      );
      // As duas escrivas vão juntas: pagamento pago com reserva pendente
      // seria dinheiro recebido sem horário garantido.
      expect(transacao).toHaveBeenCalledWith(["op-pagamento", "op-reserva"]);
    });

    it("avisa o cliente da confirmação (RF-16)", async () => {
      const { servico: s, registrar } = servico(reservaBase());

      await s.simularPagamento("r1", "u1");

      expect(registrar).toHaveBeenCalledWith({
        usuarioId: "u1",
        tipo: NotificacaoTipo.PAGAMENTO,
        titulo: "Pagamento confirmado",
        // Hora no fuso do estabelecimento, não no do servidor.
        corpo: "Arena Beach Sapiranga · Quadra 1 — 02/10, 08:00",
        destino: "/reservas/r1/confirmacao",
      });
    });

    it("não tenta avisar quando a reserva não tem cliente", async () => {
      // Reserva de balcão: existe horário, não existe a quem avisar.
      const { servico: s, registrar, transacao } = servico(
        reservaBase({ clienteId: null }),
      );

      await expect(s.simularPagamento("r1", null as unknown as string))
        .resolves.toEqual({ status: PagamentoStatus.PAGO });
      expect(transacao).toHaveBeenCalled();
      expect(registrar).not.toHaveBeenCalled();
    });
  });
});
