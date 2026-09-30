// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ReservaOrigem, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { AgendaService, janelaDoDia } from "./agenda.service";

const BLOQUEIO_CRIADO = {
  id: "b1",
  inicio: new Date("2026-10-05T17:00:00.000Z"),
  fim: new Date("2026-10-05T19:00:00.000Z"),
  status: ReservaStatus.BLOQUEIO,
  origem: ReservaOrigem.BALCAO,
  preco: new Prisma.Decimal(0),
  motivoCancelamento: "Manutenção da rede",
  quadra: { id: "q1", nome: "Quadra 1" },
  cliente: null,
  pagamento: null,
};

const RESERVA_NA_AGENDA = {
  id: "r1",
  inicio: new Date("2026-10-05T22:00:00.000Z"),
  fim: new Date("2026-10-05T23:00:00.000Z"),
  status: ReservaStatus.CONFIRMADA,
  origem: ReservaOrigem.APP,
  preco: new Prisma.Decimal(80),
  motivoCancelamento: null,
  quadra: { id: "q1", nome: "Quadra 1" },
  cliente: { id: "u1", nome: "Lucas", telefone: "51999999999" },
  pagamento: { status: "PAGO", metodo: "PIX" },
};

function servico(
  opcoes: {
    estabelecimento?: unknown;
    quadra?: unknown;
    bloqueio?: unknown;
    itens?: unknown[];
    erroAoCriar?: unknown;
  } = {},
) {
  const prisma = {
    estabelecimento: {
      findUnique: jest.fn().mockResolvedValue(
        opcoes.estabelecimento === undefined
          ? { timezone: "America/Sao_Paulo" }
          : opcoes.estabelecimento,
      ),
    },
    quadra: {
      findMany: jest.fn().mockResolvedValue([{ id: "q1", nome: "Quadra 1" }]),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.quadra === undefined ? { id: "q1" } : opcoes.quadra,
        ),
    },
    reserva: {
      findMany: jest.fn().mockResolvedValue(opcoes.itens ?? []),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.bloqueio === undefined ? { id: "b1" } : opcoes.bloqueio,
        ),
      create: opcoes.erroAoCriar
        ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
        : jest.fn().mockResolvedValue(BLOQUEIO_CRIADO),
      delete: jest.fn().mockResolvedValue({ id: "b1" }),
    },
  } as unknown as PrismaService & Record<string, never>;

  return { servico: new AgendaService(prisma), prisma };
}

const BLOQUEIO = {
  quadraId: "q1",
  inicio: "2026-10-05T17:00:00.000Z",
  fim: "2026-10-05T19:00:00.000Z",
  motivo: "Manutenção da rede",
};

describe("AgendaService", () => {
  describe("janela do dia", () => {
    it("vai da meia-noite local à meia-noite seguinte", () => {
      const { inicio, fim } = janelaDoDia("2026-10-05", "America/Sao_Paulo");
      // -03:00 no inverno: a meia-noite local é 03:00 UTC.
      expect(inicio.toISOString()).toBe("2026-10-05T03:00:00.000Z");
      expect(fim.toISOString()).toBe("2026-10-06T03:00:00.000Z");
    });

    it("acompanha o fuso do estabelecimento, não o do servidor", () => {
      // Fernando de Noronha é -02:00. Uma janela fixa em Brasília cortaria
      // uma hora da agenda de lá.
      const { inicio } = janelaDoDia("2026-10-05", "America/Noronha");
      expect(inicio.toISOString()).toBe("2026-10-05T02:00:00.000Z");
    });

    it("atravessa a virada do mês", () => {
      const { inicio, fim } = janelaDoDia("2026-10-31", "America/Sao_Paulo");
      expect(inicio.toISOString()).toBe("2026-10-31T03:00:00.000Z");
      expect(fim.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    });

    it("recusa data fora do formato", () => {
      expect(() => janelaDoDia("05/10/2026", "America/Sao_Paulo")).toThrow(
        BadRequestException,
      );
    });
  });

  describe("doDia", () => {
    it("escopa a busca pelo estabelecimento da rota", async () => {
      const { servico: s, prisma } = servico({ itens: [RESERVA_NA_AGENDA] });
      await s.doDia("e1", "2026-10-05");

      const where = (prisma.reserva.findMany as jest.Mock).mock.calls[0][0]
        .where;
      // Sem isto, a agenda de um tenant mostraria a reserva de outro — é a
      // mitigação de IDOR que o ADR-0011 exige, conferida no teste.
      expect(where.estabelecimentoId).toBe("e1");
      expect(where.status.in).toContain(ReservaStatus.BLOQUEIO);
    });

    it("pega quem começa antes e termina dentro do dia", async () => {
      const { servico: s, prisma } = servico();
      await s.doDia("e1", "2026-10-05");

      const where = (prisma.reserva.findMany as jest.Mock).mock.calls[0][0]
        .where;
      // `inicio < fimDoDia` e `fim > inicioDoDia`: um jogo que atravessa a
      // meia-noite some da agenda se a busca for só por `inicio` dentro.
      expect(where.inicio.lt.toISOString()).toBe("2026-10-06T03:00:00.000Z");
      expect(where.fim.gt.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    });

    it("traz a hora local junto do instante UTC", async () => {
      const { servico: s } = servico({ itens: [RESERVA_NA_AGENDA] });
      const agenda = await s.doDia("e1", "2026-10-05");

      expect(agenda.itens[0].horaInicio).toBe("19:00");
      expect(agenda.itens[0].preco).toBe(80);
      expect(agenda.itens[0].cliente?.nome).toBe("Lucas");
      expect(agenda.itens[0].ehBloqueio).toBe(false);
    });

    it("bloqueio não devolve preço nem cliente", async () => {
      // Devolver 0 e um cliente vazio faria a tela desenhar "R$ 0,00" e um
      // nome em branco onde não há nem cobrança nem pessoa.
      const { servico: s } = servico({ itens: [BLOQUEIO_CRIADO] });
      const agenda = await s.doDia("e1", "2026-10-05");

      expect(agenda.itens[0].ehBloqueio).toBe(true);
      expect(agenda.itens[0].preco).toBeNull();
      expect(agenda.itens[0].cliente).toBeNull();
      expect(agenda.itens[0].motivo).toBe("Manutenção da rede");
    });

    it("estabelecimento inexistente é 404", async () => {
      const { servico: s } = servico({ estabelecimento: null });
      await expect(s.doDia("e9", "2026-10-05")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("criarBloqueio", () => {
    it("grava BLOQUEIO sem cliente e com preço zero", async () => {
      const { servico: s, prisma } = servico();
      const criado = await s.criarBloqueio("e1", BLOQUEIO);

      const data = (prisma.reserva.create as jest.Mock).mock.calls[0][0].data;
      expect(data.status).toBe(ReservaStatus.BLOQUEIO);
      expect(data.clienteId).toBeUndefined();
      expect(Number(data.preco)).toBe(0);
      expect(criado.ehBloqueio).toBe(true);
    });

    it("não cria Pagamento — bloqueio não cobra de ninguém (RN-09)", async () => {
      const { servico: s, prisma } = servico();
      await s.criarBloqueio("e1", BLOQUEIO);

      const data = (prisma.reserva.create as jest.Mock).mock.calls[0][0].data;
      expect(data.pagamento).toBeUndefined();
    });

    it("procura a quadra dentro do estabelecimento da rota", async () => {
      const { servico: s, prisma } = servico();
      await s.criarBloqueio("e1", BLOQUEIO);

      // Sem o `estabelecimentoId` aqui, um admin de uma arena bloquearia a
      // quadra de outra só sabendo o id.
      expect((prisma.quadra.findFirst as jest.Mock).mock.calls[0][0].where)
        .toEqual({ id: "q1", estabelecimentoId: "e1" });
    });

    it("quadra de outro estabelecimento é 404", async () => {
      const { servico: s } = servico({ quadra: null });
      await expect(s.criarBloqueio("e1", BLOQUEIO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("fim antes do início é 400", async () => {
      const { servico: s } = servico();
      await expect(
        s.criarBloqueio("e1", { ...BLOQUEIO, fim: BLOQUEIO.inicio }),
      ).rejects.toThrow(BadRequestException);
    });

    it("horário já ocupado vira 409, não 500", async () => {
      // A mesma exclusion constraint que impede overbooking impede bloquear
      // sobre uma reserva paga. O erro do banco precisa virar 409 na tela.
      const { servico: s } = servico({
        erroAoCriar: new Error(
          'conflicting key value violates exclusion constraint "reserva_sem_sobreposicao"',
        ),
      });
      await expect(s.criarBloqueio("e1", BLOQUEIO)).rejects.toThrow(
        ConflictException,
      );
    });

    it("erro que não é de horário sobe inteiro", async () => {
      // Engolir tudo como 409 esconderia falha de banco atrás de uma
      // mensagem que culpa o usuário.
      const { servico: s } = servico({ erroAoCriar: new Error("conexão caiu") });
      await expect(s.criarBloqueio("e1", BLOQUEIO)).rejects.toThrow(
        "conexão caiu",
      );
    });
  });

  describe("removerBloqueio", () => {
    it("apaga o bloqueio e libera o horário", async () => {
      const { servico: s, prisma } = servico();
      const saida = await s.removerBloqueio("e1", "b1");

      expect(prisma.reserva.delete).toHaveBeenCalledWith({
        where: { id: "b1" },
      });
      expect(saida.removido).toBe(true);
    });

    it("só encontra bloqueio, e só dentro do estabelecimento", async () => {
      const { servico: s, prisma } = servico();
      await s.removerBloqueio("e1", "b1");

      // Sem o filtro de status, este endpoint apagaria a reserva de um
      // cliente que pagou — e `delete` não tem volta.
      expect((prisma.reserva.findFirst as jest.Mock).mock.calls[0][0].where)
        .toEqual({
          id: "b1",
          estabelecimentoId: "e1",
          status: ReservaStatus.BLOQUEIO,
        });
    });

    it("id que não é bloqueio é 404 e nada é apagado", async () => {
      const { servico: s, prisma } = servico({ bloqueio: null });
      await expect(s.removerBloqueio("e1", "r1")).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.reserva.delete).not.toHaveBeenCalled();
    });
  });
});
