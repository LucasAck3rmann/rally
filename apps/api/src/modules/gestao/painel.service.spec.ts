// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PainelService, somaDias } from "./painel.service";

/** Segunda a domingo, 8h–22h: 14 horas por dia. */
const HORARIOS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  diaSemana: d,
  abre: "08:00",
  fecha: "22:00",
}));

function reserva(opcoes: {
  id?: string;
  horas?: number;
  preco?: number;
  status?: ReservaStatus;
  pagamento?: PagamentoStatus | null;
  quadraId?: string;
  dia?: string;
} = {}) {
  // 22:00 UTC = 19:00 em Sao_Paulo, que e o horario nobre da arena.
  const inicio = new Date(`${opcoes.dia ?? "2026-10-05"}T22:00:00.000Z`);
  const fim = new Date(inicio.getTime() + (opcoes.horas ?? 1) * 3_600_000);
  return {
    id: opcoes.id ?? "r1",
    inicio,
    fim,
    status: opcoes.status ?? ReservaStatus.CONFIRMADA,
    preco: new Prisma.Decimal(opcoes.preco ?? 80),
    quadraId: opcoes.quadraId ?? "q1",
    quadra: { nome: opcoes.quadraId === "q2" ? "Quadra 2" : "Quadra 1" },
    cliente: { nome: "Lucas" },
    pagamento:
      opcoes.pagamento === null
        ? null
        : {
            status: opcoes.pagamento ?? PagamentoStatus.PAGO,
            valor: new Prisma.Decimal(opcoes.preco ?? 80),
          },
  };
}

function servico(
  opcoes: {
    estabelecimento?: unknown;
    reservas?: unknown[];
    proximas?: unknown[];
    quadras?: unknown[];
  } = {},
) {
  const prisma = {
    estabelecimento: {
      findUnique: jest.fn().mockResolvedValue(
        opcoes.estabelecimento === undefined
          ? { timezone: "America/Sao_Paulo", horarios: HORARIOS }
          : opcoes.estabelecimento,
      ),
    },
    quadra: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          opcoes.quadras ?? [{ id: "q1", nome: "Quadra 1" }],
        ),
    },
    reserva: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(opcoes.reservas ?? [])
        .mockResolvedValueOnce(opcoes.proximas ?? []),
    },
  } as unknown as PrismaService & Record<string, never>;

  return { servico: new PainelService(prisma), prisma };
}

describe("PainelService", () => {
  describe("período", () => {
    it("recusa período fora de 1 a 90 dias", async () => {
      const { servico: s } = servico();
      await expect(s.resumo("e1", 0)).rejects.toThrow(BadRequestException);
      await expect(s.resumo("e1", 91)).rejects.toThrow(BadRequestException);
    });

    it("estabelecimento inexistente é 404", async () => {
      const { servico: s } = servico({ estabelecimento: null });
      await expect(s.resumo("e1", 7)).rejects.toThrow(NotFoundException);
    });

    it("somaDias atravessa a virada do mês e o ano bissexto", () => {
      expect(somaDias("2026-10-31", 1)).toBe("2026-11-01");
      expect(somaDias("2026-01-01", -1)).toBe("2025-12-31");
      expect(somaDias("2028-02-28", 1)).toBe("2028-02-29");
    });
  });

  describe("receita", () => {
    it("separa o que entrou do que ainda pode não entrar", async () => {
      // Somar tudo num número só faria um Pix pendente parecer caixa — e
      // Pix pendente expira.
      const { servico: s } = servico({
        reservas: [
          reserva({ id: "r1", preco: 80, pagamento: PagamentoStatus.PAGO }),
          reserva({
            id: "r2",
            preco: 120,
            status: ReservaStatus.PENDENTE_PAGAMENTO,
            pagamento: PagamentoStatus.PENDENTE,
          }),
        ],
      });
      const painel = await s.resumo("e1", 7);

      expect(painel.receita.paga).toBe(80);
      expect(painel.receita.aReceber).toBe(120);
      expect(painel.receita.total).toBe(200);
      expect(painel.receita.ticketMedio).toBe(100);
    });

    it("não conta cancelada nem bloqueio como venda", async () => {
      const { servico: s } = servico({
        reservas: [
          reserva({ id: "r1", preco: 80 }),
          reserva({ id: "r2", preco: 999, status: ReservaStatus.CANCELADA }),
          reserva({
            id: "b1",
            preco: 0,
            status: ReservaStatus.BLOQUEIO,
            pagamento: null,
          }),
        ],
      });
      const painel = await s.resumo("e1", 7);

      expect(painel.receita.total).toBe(80);
      expect(painel.reservas.vendidas).toBe(1);
      expect(painel.reservas.canceladas).toBe(1);
      expect(painel.reservas.bloqueios).toBe(1);
    });

    it("sem venda nenhuma, o ticket médio é nulo e não zero", async () => {
      // Zero diria "o ticket é zero"; nulo diz "não há o que medir".
      const { servico: s } = servico();
      const painel = await s.resumo("e1", 7);
      expect(painel.receita.ticketMedio).toBeNull();
    });
  });

  describe("ocupação", () => {
    it("divide horas vendidas pela porta aberta vezes as quadras", async () => {
      // 1 dia, 14h de funcionamento, 1 quadra = 14h de capacidade.
      // Duas horas vendidas = 14,3%.
      const { servico: s } = servico({
        reservas: [reserva({ horas: 2 })],
      });
      const painel = await s.resumo("e1", 1);

      expect(painel.ocupacao.horasDisponiveis).toBe(14);
      expect(painel.ocupacao.horasVendidas).toBe(2);
      expect(painel.ocupacao.percentual).toBe(14.3);
    });

    it("conta cada quadra na capacidade", async () => {
      const { servico: s } = servico({
        quadras: [
          { id: "q1", nome: "Quadra 1" },
          { id: "q2", nome: "Quadra 2" },
        ],
        reservas: [reserva({ horas: 2 })],
      });
      const painel = await s.resumo("e1", 1);

      // Duas quadras dobram a capacidade; a mesma venda ocupa metade.
      expect(painel.ocupacao.horasDisponiveis).toBe(28);
      expect(painel.ocupacao.percentual).toBe(7.1);
    });

    it("dia fechado não entra na capacidade", async () => {
      // 2026-10-05 é segunda. Fechado na segunda: o dia não conta.
      const { servico: s } = servico({
        estabelecimento: {
          timezone: "America/Sao_Paulo",
          horarios: HORARIOS.filter((h) => h.diaSemana !== 1),
        },
      });
      const painel = await s.resumo("e1", 7);

      // 6 dias abertos × 14h × 1 quadra.
      expect(painel.ocupacao.horasDisponiveis).toBe(84);
    });

    it("sem horário cadastrado, a ocupação é nula e não zero", async () => {
      // "0%" mentiria dizendo que a arena está vazia; o que não há é
      // denominador.
      const { servico: s } = servico({
        estabelecimento: { timezone: "America/Sao_Paulo", horarios: [] },
        reservas: [reserva({ horas: 2 })],
      });
      const painel = await s.resumo("e1", 7);

      expect(painel.ocupacao.percentual).toBeNull();
      expect(painel.ocupacao.horasVendidas).toBe(2);
    });
  });

  describe("cancelamento", () => {
    it("divide pelo total decidido, não pelo que sobrou", async () => {
      // 1 vendida e 1 cancelada = 50%. Dividir só pelas vendidas daria
      // 100% e esconderia exatamente o que a métrica mostra.
      const { servico: s } = servico({
        reservas: [
          reserva({ id: "r1" }),
          reserva({ id: "r2", status: ReservaStatus.CANCELADA }),
        ],
      });
      const painel = await s.resumo("e1", 7);
      expect(painel.reservas.taxaCancelamento).toBe(50);
    });

    it("sem reserva nenhuma, a taxa é nula", async () => {
      const { servico: s } = servico();
      const painel = await s.resumo("e1", 7);
      expect(painel.reservas.taxaCancelamento).toBeNull();
    });
  });

  describe("por quadra", () => {
    it("ordena pela receita, do maior para o menor", async () => {
      const { servico: s } = servico({
        quadras: [
          { id: "q1", nome: "Quadra 1" },
          { id: "q2", nome: "Quadra 2" },
        ],
        reservas: [
          reserva({ id: "r1", quadraId: "q1", preco: 80 }),
          reserva({ id: "r2", quadraId: "q2", preco: 200 }),
        ],
      });
      const painel = await s.resumo("e1", 7);

      expect(painel.porQuadra.map((q) => q.nome)).toEqual([
        "Quadra 2",
        "Quadra 1",
      ]);
      expect(painel.porQuadra[0].receita).toBe(200);
    });

    it("quadra sem venda aparece zerada, e não some", async () => {
      // Sumir da lista faria parecer que a quadra não existe — e é
      // justamente a quadra parada que o dono precisa ver.
      const { servico: s } = servico({
        quadras: [
          { id: "q1", nome: "Quadra 1" },
          { id: "q2", nome: "Quadra 2" },
        ],
        reservas: [reserva({ quadraId: "q1" })],
      });
      const painel = await s.resumo("e1", 7);

      expect(painel.porQuadra).toHaveLength(2);
      expect(painel.porQuadra[1]).toMatchObject({
        nome: "Quadra 2",
        reservas: 0,
        receita: 0,
      });
    });
  });

  describe("próximos jogos", () => {
    it("traz hora local e se já está pago", async () => {
      const { servico: s } = servico({
        proximas: [reserva({ id: "r9", pagamento: PagamentoStatus.PAGO })],
      });
      const painel = await s.resumo("e1", 7);

      expect(painel.proximosJogos[0]).toMatchObject({
        id: "r9",
        quadraNome: "Quadra 1",
        clienteNome: "Lucas",
        horaInicio: "19:00",
        pago: true,
      });
    });

    it("pede só os cinco próximos, a partir de agora", async () => {
      const { servico: s, prisma } = servico();
      await s.resumo("e1", 7);

      const consulta = (prisma.reserva.findMany as jest.Mock).mock.calls[1][0];
      expect(consulta.take).toBe(5);
      expect(consulta.where.estabelecimentoId).toBe("e1");
      expect(consulta.where.inicio.gte).toBeInstanceOf(Date);
      expect(consulta.orderBy).toEqual({ inicio: "asc" });
    });
  });

  it("escopa toda a leitura pelo estabelecimento da rota", async () => {
    const { servico: s, prisma } = servico();
    await s.resumo("e1", 7);

    // ADR-0011: o painel de um tenant não pode somar a receita de outro.
    for (const chamada of (prisma.reserva.findMany as jest.Mock).mock.calls) {
      expect(chamada[0].where.estabelecimentoId).toBe("e1");
    }
    expect(
      (prisma.quadra.findMany as jest.Mock).mock.calls[0][0].where
        .estabelecimentoId,
    ).toBe("e1");
  });
});
