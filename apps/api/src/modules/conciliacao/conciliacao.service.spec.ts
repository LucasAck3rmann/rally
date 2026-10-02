// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from "@nestjs/common";
import { PagamentoMetodo, PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ConciliacaoService } from "./conciliacao.service";

const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000);
const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000);

function reserva(opcoes: {
  id?: string;
  status?: ReservaStatus;
  preco?: number;
  pagamento?: {
    status?: PagamentoStatus;
    valor?: number;
    expiraEm?: Date | null;
  } | null;
} = {}) {
  const p = opcoes.pagamento;
  return {
    id: opcoes.id ?? "ckabcd1234",
    status: opcoes.status ?? ReservaStatus.CONFIRMADA,
    preco: new Prisma.Decimal(opcoes.preco ?? 80),
    inicio: new Date("2026-10-05T22:00:00.000Z"),
    quadra: { nome: "Quadra 1" },
    cliente: { nome: "Lucas" },
    pagamento:
      p === null
        ? null
        : {
            status: p?.status ?? PagamentoStatus.PAGO,
            valor: new Prisma.Decimal(p?.valor ?? opcoes.preco ?? 80),
            metodo: PagamentoMetodo.PIX,
            expiraEm: p?.expiraEm ?? AMANHA,
          },
  };
}

function servico(
  opcoes: { estabelecimento?: unknown; reservas?: unknown[]; alvo?: unknown[] } = {},
) {
  const prisma = {
    estabelecimento: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.estabelecimento === undefined ? { id: "e1" } : opcoes.estabelecimento,
        ),
    },
    reserva: {
      findMany: jest.fn().mockResolvedValue(opcoes.reservas ?? opcoes.alvo ?? []),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    pagamento: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn().mockResolvedValue([]),
  } as unknown as PrismaService & Record<string, never>;

  return { servico: new ConciliacaoService(prisma), prisma };
}

describe("ConciliacaoService (RF-29)", () => {
  it("estabelecimento inexistente é 404", async () => {
    const { servico: s } = servico({ estabelecimento: null });
    await expect(s.relatorio("e9")).rejects.toThrow(NotFoundException);
  });

  it("não tenta conciliar bloqueio — ele não tem cobrança", async () => {
    const { servico: s, prisma } = servico();
    await s.relatorio("e1");

    const where = (prisma.reserva.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.estabelecimentoId).toBe("e1");
    expect(where.status).toEqual({ not: ReservaStatus.BLOQUEIO });
  });

  it("par que fecha não gera divergência", async () => {
    const { servico: s } = servico({ reservas: [reserva()] });
    const r = await s.relatorio("e1");

    expect(r.conferidas).toBe(1);
    expect(r.divergencias).toEqual([]);
    expect(r.graves).toBe(0);
  });

  describe("divergências graves", () => {
    it("Pix expirado ainda ocupando o horário", async () => {
      // Custa faturamento todo dia que passa: o slot está preso e ninguém
      // pode comprá-lo.
      const { servico: s } = servico({
        reservas: [
          reserva({
            status: ReservaStatus.PENDENTE_PAGAMENTO,
            pagamento: { status: PagamentoStatus.PENDENTE, expiraEm: ONTEM },
          }),
        ],
      });
      const r = await s.relatorio("e1");

      expect(r.divergencias[0].tipo).toBe("PENDENTE_EXPIRADA");
      expect(r.divergencias[0].gravidade).toBe("grave");
      expect(r.graves).toBe(1);
    });

    it("Pix pendente dentro do prazo não é divergência", async () => {
      // Acusar o checkout em andamento encheria o relatório de ruído e
      // ensinaria o dono a ignorá-lo.
      const { servico: s } = servico({
        reservas: [
          reserva({
            status: ReservaStatus.PENDENTE_PAGAMENTO,
            pagamento: { status: PagamentoStatus.PENDENTE, expiraEm: AMANHA },
          }),
        ],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias).toEqual([]);
    });

    it("cancelada com pagamento confirmado — estorno devido", async () => {
      const { servico: s } = servico({
        reservas: [
          reserva({
            status: ReservaStatus.CANCELADA,
            pagamento: { status: PagamentoStatus.PAGO },
          }),
        ],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias.map((d) => d.tipo)).toContain("CANCELADA_PAGA");
    });

    it("pago e reserva ainda pendente — o cliente aparece sem vaga", async () => {
      const { servico: s } = servico({
        reservas: [
          reserva({
            status: ReservaStatus.PENDENTE_PAGAMENTO,
            pagamento: { status: PagamentoStatus.PAGO },
          }),
        ],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias.map((d) => d.tipo)).toContain("PAGA_NAO_CONFIRMADA");
    });

    it("cobrança acima do preço da reserva", async () => {
      const { servico: s } = servico({
        reservas: [reserva({ preco: 80, pagamento: { valor: 120 } })],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias.map((d) => d.tipo)).toContain("VALOR_DIVERGENTE");
    });

    it("cobrança **menor** não é divergência — é o desconto do Pix (RN-03)", async () => {
      // 80 com 5% dá 76. Acusar isso faria o relatório brigar com uma regra
      // de negócio do próprio sistema.
      const { servico: s } = servico({
        reservas: [reserva({ preco: 80, pagamento: { valor: 76 } })],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias.map((d) => d.tipo)).not.toContain("VALOR_DIVERGENTE");
    });

    it("compara em centavos, não em ponto flutuante", async () => {
      // `0.1 + 0.2 !== 0.3`; um relatório que acusa 0,000001 de diferença
      // não se usa.
      const { servico: s } = servico({
        reservas: [reserva({ preco: 0.3, pagamento: { valor: 0.1 + 0.2 } })],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias).toEqual([]);
    });
  });

  describe("divergências de atenção", () => {
    it("confirmada sem pagamento é atenção, não grave", async () => {
      // É o normal da reserva de balcão, paga fora do sistema.
      const { servico: s } = servico({
        reservas: [
          reserva({ status: ReservaStatus.CONFIRMADA, pagamento: null }),
        ],
      });
      const r = await s.relatorio("e1");

      expect(r.divergencias[0].tipo).toBe("CONFIRMADA_SEM_PAGAMENTO");
      expect(r.divergencias[0].gravidade).toBe("atencao");
      expect(r.graves).toBe(0);
    });

    it("pendente sem cobrança nenhuma", async () => {
      const { servico: s } = servico({
        reservas: [
          reserva({ status: ReservaStatus.PENDENTE_PAGAMENTO, pagamento: null }),
        ],
      });
      const r = await s.relatorio("e1");
      expect(r.divergencias.map((d) => d.tipo)).toContain("SEM_COBRANCA");
    });
  });

  it("uma reserva pode acusar mais de uma divergência", async () => {
    // Status errado e valor errado são problemas independentes; relatar só
    // o primeiro esconderia o segundo até alguém corrigir aquele.
    const { servico: s } = servico({
      reservas: [
        reserva({
          status: ReservaStatus.CANCELADA,
          preco: 80,
          pagamento: { status: PagamentoStatus.PAGO, valor: 200 },
        }),
      ],
    });
    const r = await s.relatorio("e1");

    const tipos = r.divergencias.map((d) => d.tipo);
    expect(tipos).toContain("CANCELADA_PAGA");
    expect(tipos).toContain("VALOR_DIVERGENTE");
  });

  it("agrupa por tipo, do mais frequente para o menos", async () => {
    const { servico: s } = servico({
      reservas: [
        reserva({ id: "a", status: ReservaStatus.CONFIRMADA, pagamento: null }),
        reserva({ id: "b", status: ReservaStatus.CONFIRMADA, pagamento: null }),
        reserva({
          id: "c",
          status: ReservaStatus.CANCELADA,
          pagamento: { status: PagamentoStatus.PAGO },
        }),
      ],
    });
    const r = await s.relatorio("e1");

    expect(r.porTipo[0]).toMatchObject({
      tipo: "CONFIRMADA_SEM_PAGAMENTO",
      quantidade: 2,
    });
  });

  it("devolve o código que o cliente dita no balcão", async () => {
    const { servico: s } = servico({
      reservas: [reserva({ id: "ckxyz7k2p", status: ReservaStatus.CANCELADA, pagamento: { status: PagamentoStatus.PAGO } })],
    });
    const r = await s.relatorio("e1");
    expect(r.divergencias[0].codigo).toBe("RALLY-7K2P");
  });

  describe("expirarPendentes (RN-13)", () => {
    it("procura só pendente com Pix pendente e vencido", async () => {
      const { servico: s, prisma } = servico();
      await s.expirarPendentes({ estabelecimentoId: "e1" });

      const where = (prisma.reserva.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.status).toBe(ReservaStatus.PENDENTE_PAGAMENTO);
      expect(where.pagamento.status).toBe(PagamentoStatus.PENDENTE);
      expect(where.pagamento.expiraEm.lt).toBeInstanceOf(Date);
      expect(where.estabelecimentoId).toBe("e1");
    });

    it("sem nada vencido, não escreve", async () => {
      // Idempotência: a grade chama isto a cada leitura, e um `updateMany`
      // por requisição seria escrita à toa no caminho de leitura.
      const { servico: s, prisma } = servico();
      const liberadas = await s.expirarPendentes({ quadraId: "q1" });

      expect(liberadas).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("cancela a reserva e expira a cobrança na mesma transação", async () => {
      // Deixar o pagamento PENDENTE faria o relatório continuar acusando a
      // mesma divergência depois de ela ter sido resolvida.
      const { servico: s, prisma } = servico({ alvo: [{ id: "r1" }, { id: "r2" }] });
      const liberadas = await s.expirarPendentes({ estabelecimentoId: "e1" });

      expect(liberadas).toBe(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const dados = (prisma.reserva.updateMany as jest.Mock).mock.calls[0][0];
      expect(dados.where.id.in).toEqual(["r1", "r2"]);
      expect(dados.data.status).toBe(ReservaStatus.CANCELADA);
      expect(dados.data.motivoCancelamento).toContain("expirou");
      expect(
        (prisma.pagamento.updateMany as jest.Mock).mock.calls[0][0].data.status,
      ).toBe(PagamentoStatus.EXPIRADO);
    });

    it("pode varrer uma quadra só, que é o que a grade pede", async () => {
      const { servico: s, prisma } = servico();
      await s.expirarPendentes({ quadraId: "q1" });

      const where = (prisma.reserva.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.quadraId).toBe("q1");
      expect(where.estabelecimentoId).toBeUndefined();
    });
  });
});
