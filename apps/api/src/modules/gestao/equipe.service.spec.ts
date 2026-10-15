// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { EquipeService } from "./equipe.service";

const MEMBRO = {
  id: "m1",
  role: Role.ATENDENTE,
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  usuario: {
    id: "u2",
    nome: "Augusto Boff",
    email: "augusto@rally.com.br",
    avatarUrl: null,
  },
};

function servico(
  opcoes: {
    usuario?: unknown;
    vinculo?: unknown;
    admins?: number;
    lista?: unknown[];
  } = {},
) {
  const prisma = {
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.usuario === undefined ? { id: "u2" } : opcoes.usuario,
        ),
    },
    membership: {
      findMany: jest.fn().mockResolvedValue(opcoes.lista ?? [MEMBRO]),
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.vinculo === undefined
            ? { id: "m1", role: Role.ATENDENTE }
            : opcoes.vinculo,
        ),
      count: jest.fn().mockResolvedValue(opcoes.admins ?? 2),
      create: jest.fn().mockResolvedValue(MEMBRO),
      update: jest.fn().mockResolvedValue(MEMBRO),
    },
  } as unknown as PrismaService & Record<string, never>;

  return { servico: new EquipeService(prisma), prisma };
}

describe("EquipeService", () => {
  describe("listar", () => {
    it("traz só quem trabalha, não quem só joga", async () => {
      const { servico: s, prisma } = servico();
      await s.listar("e1");

      const where = (prisma.membership.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(where.estabelecimentoId).toBe("e1");
      expect(where.role.in).toEqual([
        Role.ADMIN,
        Role.ATENDENTE,
        Role.FINANCEIRO,
      ]);
      expect(where.role.in).not.toContain(Role.CLIENTE);
    });

    it("devolve nome, e-mail, papel e desde quando", async () => {
      const { servico: s } = servico();
      const equipe = await s.listar("e1");

      expect(equipe[0]).toMatchObject({
        usuarioId: "u2",
        nome: "Augusto Boff",
        email: "augusto@rally.com.br",
        papel: Role.ATENDENTE,
      });
      expect(equipe[0].desde).toBe("2026-09-01T12:00:00.000Z");
    });
  });

  describe("adicionar", () => {
    it("cria o vínculo de quem ainda não tinha", async () => {
      const { servico: s, prisma } = servico({ vinculo: null });
      await s.adicionar("e1", "augusto@rally.com.br", Role.ATENDENTE);

      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          usuarioId: "u2",
          estabelecimentoId: "e1",
          role: Role.ATENDENTE,
        },
        select: expect.anything(),
      });
    });

    it("normaliza o e-mail antes de procurar", async () => {
      // "  Augusto@Rally.com.BR  " tem de achar a mesma conta — senão o
      // convite falha por um espaço que ninguém vê.
      const { servico: s, prisma } = servico({ vinculo: null });
      await s.adicionar("e1", "  Augusto@Rally.com.BR  ", Role.ADMIN);

      expect(
        (prisma.usuario.findUnique as jest.Mock).mock.calls[0][0].where.email,
      ).toBe("augusto@rally.com.br");
    });

    it("quem não tem conta vira 404 com o motivo", async () => {
      // O MVP não tem convite pendente nem e-mail transacional; a recusa
      // diz o que fazer em vez de fingir que deu certo.
      const { servico: s } = servico({ usuario: null });
      await expect(
        s.adicionar("e1", "ninguem@rally.com.br", Role.ATENDENTE),
      ).rejects.toThrow(NotFoundException);
    });

    it("promove quem já era cliente pelo mesmo vínculo", async () => {
      // Criar um segundo esbarraria no índice único e, pior, daria dois
      // papéis para a mesma pessoa no mesmo lugar.
      const { servico: s, prisma } = servico({
        vinculo: { id: "m9", role: Role.CLIENTE },
      });
      await s.adicionar("e1", "augusto@rally.com.br", Role.FINANCEIRO);

      expect(prisma.membership.create).not.toHaveBeenCalled();
      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { id: "m9" },
        data: { role: Role.FINANCEIRO },
        select: expect.anything(),
      });
    });

    it("quem já está na equipe é 409", async () => {
      const { servico: s } = servico({
        vinculo: { id: "m1", role: Role.ATENDENTE },
      });
      await expect(
        s.adicionar("e1", "augusto@rally.com.br", Role.ADMIN),
      ).rejects.toThrow(ConflictException);
    });

    it("não dá para entrar como CLIENTE nem como MANTENEDOR", async () => {
      // Sem esta checagem, um admin de arena se promoveria a mantenedor e
      // sairia do próprio tenant.
      const { servico: s } = servico({ vinculo: null });
      for (const papel of [Role.CLIENTE, Role.MANTENEDOR]) {
        await expect(
          s.adicionar("e1", "augusto@rally.com.br", papel),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });

  describe("trocar papel", () => {
    it("troca o papel de quem está na equipe", async () => {
      const { servico: s, prisma } = servico();
      await s.trocarPapel("e1", "u2", Role.ADMIN, "u1");

      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { role: Role.ADMIN },
        select: expect.anything(),
      });
    });

    it("quem não está na equipe é 404, mesmo sendo cliente", async () => {
      // Cliente e desconhecido dão o mesmo 404: a rota não deve nem
      // confirmar que a pessoa existe no sistema.
      const { servico: s } = servico({
        vinculo: { id: "m9", role: Role.CLIENTE },
      });
      await expect(
        s.trocarPapel("e1", "u9", Role.ATENDENTE, "u1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("não rebaixa o último administrador", async () => {
      // Sem esta trava, um admin se rebaixa por engano e tranca a arena —
      // e não há tela para desfazer, porque a tela exige ser admin.
      const { servico: s, prisma } = servico({
        vinculo: { id: "m1", role: Role.ADMIN },
        admins: 1,
      });
      await expect(
        s.trocarPapel("e1", "u2", Role.ATENDENTE, "u1"),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it("a mensagem muda quando é você mesmo", async () => {
      const { servico: s } = servico({
        vinculo: { id: "m1", role: Role.ADMIN },
        admins: 1,
      });
      await expect(
        s.trocarPapel("e1", "u1", Role.ATENDENTE, "u1"),
      ).rejects.toThrow("Você é o único administrador");
    });

    it("com outro admin, rebaixar é permitido", async () => {
      const { servico: s, prisma } = servico({
        vinculo: { id: "m1", role: Role.ADMIN },
        admins: 2,
      });
      await s.trocarPapel("e1", "u2", Role.ATENDENTE, "u1");
      expect(prisma.membership.update).toHaveBeenCalled();
    });

    it("promover admin para admin não conta como rebaixar", async () => {
      // A trava só deve disparar quando o número de admins cairia.
      const { servico: s, prisma } = servico({
        vinculo: { id: "m1", role: Role.ADMIN },
        admins: 1,
      });
      await s.trocarPapel("e1", "u2", Role.ADMIN, "u1");
      expect(prisma.membership.update).toHaveBeenCalled();
      expect(prisma.membership.count).not.toHaveBeenCalled();
    });
  });

  describe("remover", () => {
    it("vira cliente em vez de apagar a linha", async () => {
      // A pessoa pode ter reservas na arena; apagar derrubaria o histórico
      // dela por causa de uma mudança de cargo.
      const { servico: s, prisma } = servico();
      const saida = await s.remover("e1", "u2", "u1");

      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { role: Role.CLIENTE },
      });
      expect(saida.removido).toBe(true);
    });

    it("não remove o último administrador", async () => {
      const { servico: s, prisma } = servico({
        vinculo: { id: "m1", role: Role.ADMIN },
        admins: 1,
      });
      await expect(s.remover("e1", "u1", "u1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it("escopa a busca pelo estabelecimento da rota", async () => {
      const { servico: s, prisma } = servico();
      await s.remover("e1", "u2", "u1");

      // ADR-0011: sem o par (usuário, estabelecimento) daria para tirar
      // alguém da equipe de outra arena.
      expect(
        (prisma.membership.findUnique as jest.Mock).mock.calls[0][0].where,
      ).toEqual({
        usuarioId_estabelecimentoId: {
          usuarioId: "u2",
          estabelecimentoId: "e1",
        },
      });
    });
  });
});
