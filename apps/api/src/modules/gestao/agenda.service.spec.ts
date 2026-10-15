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
    reserva?: unknown;
    itens?: unknown[];
    erroAoCriar?: unknown;
    erroAoMover?: unknown;
    movida?: unknown;
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
          opcoes.reserva !== undefined
            ? opcoes.reserva
            : opcoes.bloqueio === undefined
              ? { id: "b1" }
              : opcoes.bloqueio,
        ),
      update: opcoes.erroAoMover
        ? jest.fn().mockRejectedValue(opcoes.erroAoMover)
        : jest.fn().mockResolvedValue(opcoes.movida ?? RESERVA_NA_AGENDA),
      create: opcoes.erroAoCriar
        ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
        : jest.fn().mockResolvedValue(BLOQUEIO_CRIADO),
      delete: jest.fn().mockResolvedValue({ id: "b1" }),
    },
    pagamento: { update: jest.fn() },
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

  describe("mover reserva (RF-21)", () => {
    const HORA = 60 * 60 * 1000;
    /** Daqui a `h` horas, em ISO — o serviço recusa mover o que já começou. */
    const daqui = (h: number) => new Date(Date.now() + h * HORA).toISOString();

    function reservaFutura(parcial: Record<string, unknown> = {}) {
      return {
        id: "r1",
        inicio: new Date(Date.now() + 3 * HORA),
        status: ReservaStatus.CONFIRMADA,
        quadraId: "q1",
        ...parcial,
      };
    }

    it("muda horário e quadra sem tocar no preço nem no pagamento", async () => {
      // A decisão que este teste protege: mover é iniciativa da casa. Cobrar
      // a mais por uma quadra que o cliente não escolheu repassaria a ele o
      // custo de um problema que não é dele.
      const { servico: s, prisma } = servico({ reserva: reservaFutura() });

      await s.moverReserva("e1", "r1", {
        quadraId: "q2",
        inicio: daqui(5),
        fim: daqui(6),
      });

      const dados = (prisma.reserva.update as jest.Mock).mock.calls[0][0].data;
      expect(dados.quadraId).toBe("q2");
      expect(dados).not.toHaveProperty("preco");
      expect(prisma.pagamento.update).not.toHaveBeenCalled();
    });

    it("sem quadra no pedido, mantém a quadra atual", async () => {
      const { servico: s, prisma } = servico({ reserva: reservaFutura() });

      await s.moverReserva("e1", "r1", { inicio: daqui(5), fim: daqui(6) });

      const dados = (prisma.reserva.update as jest.Mock).mock.calls[0][0].data;
      expect(dados.quadraId).toBe("q1");
      // E não vai conferir quadra nenhuma: não mudou de quadra.
      expect(prisma.quadra.findFirst).not.toHaveBeenCalled();
    });

    it("move mesmo dentro do prazo em que o cliente já não remarcaria", async () => {
      // É a diferença que justifica o endpoint existir. A janela da RN-02
      // protege a arena de quem empurraria a reserva para longe e cancelaria
      // de graça depois; aplicá-la ao dono inverteria o sentido da regra, e
      // quadra alagada é problema que aparece em cima da hora.
      const { servico: s, prisma } = servico({
        reserva: reservaFutura({ inicio: new Date(Date.now() + 0.5 * HORA) }),
      });

      await expect(
        s.moverReserva("e1", "r1", { inicio: daqui(2), fim: daqui(3) }),
      ).resolves.toBeDefined();
      expect(prisma.reserva.update).toHaveBeenCalled();
    });

    it("confere a quadra de destino dentro do estabelecimento da rota", async () => {
      // ADR-0011: sem o escopo, um admin moveria a reserva para a quadra de
      // outra arena sabendo o id.
      const { servico: s, prisma } = servico({ reserva: reservaFutura() });

      await s.moverReserva("e1", "r1", {
        quadraId: "q2",
        inicio: daqui(5),
        fim: daqui(6),
      });

      expect((prisma.quadra.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
        id: "q2",
        estabelecimentoId: "e1",
      });
      expect((prisma.reserva.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
        id: "r1",
        estabelecimentoId: "e1",
      });
    });

    it("quadra de destino de outra arena é 404", async () => {
      const { servico: s } = servico({ reserva: reservaFutura(), quadra: null });

      await expect(
        s.moverReserva("e1", "r1", {
          quadraId: "q9",
          inicio: daqui(5),
          fim: daqui(6),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("reserva de outra arena é 404", async () => {
      const { servico: s } = servico({ reserva: null });

      await expect(
        s.moverReserva("e1", "r1", { inicio: daqui(5), fim: daqui(6) }),
      ).rejects.toThrow(NotFoundException);
    });

    it("bloqueio não se move por aqui, e a recusa diz o caminho", async () => {
      // Bloqueio tem par próprio de criar e remover, e o remover apaga em
      // vez de cancelar.
      const { servico: s } = servico({
        reserva: reservaFutura({ status: ReservaStatus.BLOQUEIO }),
      });

      await expect(
        s.moverReserva("e1", "b1", { inicio: daqui(5), fim: daqui(6) }),
      ).rejects.toThrow(/remova e crie de novo/i);
    });

    it("recusa reserva cancelada, concluída e já começada", async () => {
      for (const [parcial, motivo] of [
        [{ status: ReservaStatus.CANCELADA }, /já foi cancelada/i],
        [{ status: ReservaStatus.CONCLUIDA }, /já aconteceu/i],
        [{ inicio: new Date(Date.now() - HORA) }, /já começou/i],
      ] as const) {
        const { servico: s } = servico({ reserva: reservaFutura(parcial) });
        await expect(
          s.moverReserva("e1", "r1", { inicio: daqui(5), fim: daqui(6) }),
        ).rejects.toThrow(motivo);
      }
    });

    it("recusa fim antes do início e data inválida", async () => {
      const { servico: s } = servico({ reserva: reservaFutura() });

      await expect(
        s.moverReserva("e1", "r1", { inicio: daqui(6), fim: daqui(5) }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        s.moverReserva("e1", "r1", { inicio: "nao-e-data", fim: daqui(5) }),
      ).rejects.toThrow(BadRequestException);
    });

    it("sobreposição é barrada pelo banco, não por consulta prévia", async () => {
      // Entre conferir e gravar cabe outra reserva: a trava é a
      // `reserva_sem_sobreposicao` (RN-01).
      const { servico: s } = servico({
        reserva: reservaFutura(),
        erroAoMover: new Error(
          'conflicting key value violates exclusion constraint "reserva_sem_sobreposicao"',
        ),
      });

      await expect(
        s.moverReserva("e1", "r1", { inicio: daqui(5), fim: daqui(6) }),
      ).rejects.toThrow(ConflictException);
    });

    it("erro que não é de sobreposição sobe sem virar 409", async () => {
      const { servico: s } = servico({
        reserva: reservaFutura(),
        erroAoMover: new Error("conexão caiu"),
      });

      await expect(
        s.moverReserva("e1", "r1", { inicio: daqui(5), fim: daqui(6) }),
      ).rejects.toThrow("conexão caiu");
    });
  });
});
