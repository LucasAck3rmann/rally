// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo, Prisma, ReplayStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { IngestaoDeReplaysService } from "./ingestao.service";

const ENTREGA = {
  quadraId: "q1",
  gravadoEm: "2026-10-05T22:05:00.000Z",
  s3Key: "clipes/2026/10/05/q1-220500.mp4",
  url: "https://cdn.exemplo.com/clipes/q1-220500.mp4",
  duracaoSeg: 42,
};

function criado(parcial: Partial<Record<string, unknown>> = {}) {
  return {
    id: "rp1",
    quadraId: "q1",
    reservaId: "r1",
    clienteId: "u1",
    status: ReplayStatus.PRONTO,
    gravadoEm: new Date(ENTREGA.gravadoEm),
    ...parcial,
  };
}

function servico(
  opcoes: {
    quadra?: unknown;
    existente?: unknown;
    reserva?: unknown;
    erroAoCriar?: unknown;
    criado?: unknown;
  } = {},
) {
  const prisma = {
    quadra: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.quadra === undefined
            ? { id: "q1", estabelecimentoId: "e1" }
            : opcoes.quadra,
        ),
    },
    reserva: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.reserva === undefined ? { id: "r1", clienteId: "u1" } : opcoes.reserva,
        ),
    },
    replay: {
      findUnique: jest.fn().mockResolvedValue(opcoes.existente ?? null),
      create: opcoes.erroAoCriar
        ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
        : jest.fn().mockResolvedValue(opcoes.criado ?? criado()),
    },
  } as unknown as PrismaService & Record<string, never>;

  const notificacoes = { registrar: jest.fn().mockResolvedValue(undefined) };

  return {
    servico: new IngestaoDeReplaysService(
      prisma,
      notificacoes as unknown as NotificacoesService,
    ),
    prisma,
    notificacoes,
  };
}

describe("IngestaoDeReplaysService (RF-30)", () => {
  describe("vínculo", () => {
    it("liga o clipe à reserva e, por ela, ao cliente", async () => {
      // É o que o parceiro de vídeo não sabe responder, e o que o Rally
      // existe para responder (ADR-0012).
      const { servico: s, prisma } = servico();
      const saida = await s.ingestar(ENTREGA);

      const data = (prisma.replay.create as jest.Mock).mock.calls[0][0].data;
      expect(data.reservaId).toBe("r1");
      expect(data.clienteId).toBe("u1");
      expect(saida.vinculado).toBe(true);
    });

    it("procura a reserva pelo instante do lance, não pela hora de início", async () => {
      const { servico: s, prisma } = servico();
      await s.ingestar(ENTREGA);

      const where = (prisma.reserva.findFirst as jest.Mock).mock.calls[0][0].where;
      // `inicio <= t < fim`: às 20:00 em ponto o jogo das 19h já acabou e o
      // das 20h começou. Sem a assimetria, o clipe da virada casaria com os
      // dois.
      expect(where.inicio.lte).toEqual(new Date(ENTREGA.gravadoEm));
      expect(where.fim.gt).toEqual(new Date(ENTREGA.gravadoEm));
      expect(where.quadraId).toBe("q1");
      expect(where.estabelecimentoId).toBe("e1");
    });

    it("não casa com bloqueio nem com reserva cancelada", async () => {
      const { servico: s, prisma } = servico();
      await s.ingestar(ENTREGA);

      const status = (prisma.reserva.findFirst as jest.Mock).mock.calls[0][0].where
        .status.in;
      expect(status).not.toContain(ReservaStatus.BLOQUEIO);
      expect(status).not.toContain(ReservaStatus.CANCELADA);
    });

    it("clipe sem reserva no horário fica órfão, e não é recusado", async () => {
      // É vídeo de quadra vazia, de aula avulsa ou de horário bloqueado.
      // Apagá-lo perderia material; inventar um dono seria pior.
      const { servico: s, prisma } = servico({
        reserva: null,
        criado: criado({ reservaId: null, clienteId: null }),
      });
      const saida = await s.ingestar(ENTREGA);

      const data = (prisma.replay.create as jest.Mock).mock.calls[0][0].data;
      expect(data.reservaId).toBeNull();
      expect(data.clienteId).toBeNull();
      expect(saida.vinculado).toBe(false);
    });

    it("quadra inexistente é 404", async () => {
      const { servico: s } = servico({ quadra: null });
      await expect(s.ingestar(ENTREGA)).rejects.toThrow(NotFoundException);
    });

    it("`gravadoEm` inválido é 400", async () => {
      const { servico: s } = servico();
      await expect(
        s.ingestar({ ...ENTREGA, gravadoEm: "ontem à noite" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("idempotência", () => {
    it("reentrega do mesmo clipe devolve o que já existe", async () => {
      // O provedor reentrega quando não recebe 2xx; criar um segundo
      // duplicaria o mesmo vídeo na galeria do cliente.
      const { servico: s, prisma } = servico({ existente: criado() });
      const saida = await s.ingestar(ENTREGA);

      expect(saida.jaExistia).toBe(true);
      expect(prisma.replay.create).not.toHaveBeenCalled();
    });

    it("procura pelo s3Key, que é a chave de idempotência", async () => {
      const { servico: s, prisma } = servico({ existente: criado() });
      await s.ingestar(ENTREGA);

      expect((prisma.replay.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({
        s3Key: ENTREGA.s3Key,
      });
    });

    it("corrida entre duas entregas devolve o vencedor, não erro", async () => {
      // A checagem na aplicação tem janela entre o SELECT e o INSERT; quem
      // decide é o índice único do banco. A segunda entrega perde no P2002
      // e precisa responder como se tivesse criado.
      const prisma = {
        quadra: {
          findUnique: jest.fn().mockResolvedValue({ id: "q1", estabelecimentoId: "e1" }),
        },
        reserva: { findFirst: jest.fn().mockResolvedValue({ id: "r1", clienteId: "u1" }) },
        replay: {
          // Primeiro `findUnique` não acha; o segundo, depois do conflito, acha.
          findUnique: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(criado()),
          create: jest.fn().mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError("conflito", {
              code: "P2002",
              clientVersion: "6",
            }),
          ),
        },
      } as unknown as PrismaService & Record<string, never>;

      const s = new IngestaoDeReplaysService(
        prisma,
        { registrar: jest.fn() } as unknown as NotificacoesService,
      );
      const saida = await s.ingestar(ENTREGA);

      expect(saida.jaExistia).toBe(true);
      expect(saida.id).toBe("rp1");
    });

    it("erro que não é de unicidade sobe inteiro", async () => {
      // Engolir tudo como conflito esconderia falha de banco atrás de uma
      // resposta de sucesso.
      const { servico: s } = servico({ erroAoCriar: new Error("conexão caiu") });
      await expect(s.ingestar(ENTREGA)).rejects.toThrow("conexão caiu");
    });
  });

  describe("status e aviso", () => {
    it("clipe com URL entra PRONTO", async () => {
      const { servico: s, prisma } = servico();
      await s.ingestar(ENTREGA);

      const data = (prisma.replay.create as jest.Mock).mock.calls[0][0].data;
      expect(data.status).toBe(ReplayStatus.PRONTO);
    });

    it("clipe sem URL entra PROCESSANDO", async () => {
      const { servico: s, prisma } = servico({
        criado: criado({ status: ReplayStatus.PROCESSANDO }),
      });
      await s.ingestar({ ...ENTREGA, url: undefined });

      const data = (prisma.replay.create as jest.Mock).mock.calls[0][0].data;
      expect(data.status).toBe(ReplayStatus.PROCESSANDO);
    });

    it("avisa o cliente quando o clipe está pronto (RF-18)", async () => {
      const { servico: s, notificacoes } = servico();
      await s.ingestar(ENTREGA);

      expect(notificacoes.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: "u1",
          tipo: NotificacaoTipo.REPLAY,
          destino: "/replays",
        }),
      );
    });

    it("não avisa sobre clipe que ainda está processando", async () => {
      // Mandaria a pessoa para uma tela vazia.
      const { servico: s, notificacoes } = servico({
        criado: criado({ status: ReplayStatus.PROCESSANDO }),
      });
      await s.ingestar({ ...ENTREGA, url: undefined });

      expect(notificacoes.registrar).not.toHaveBeenCalled();
    });

    it("não avisa ninguém quando o clipe é órfão", async () => {
      const { servico: s, notificacoes } = servico({
        reserva: null,
        criado: criado({ reservaId: null, clienteId: null }),
      });
      await s.ingestar(ENTREGA);

      expect(notificacoes.registrar).not.toHaveBeenCalled();
    });
  });
});
