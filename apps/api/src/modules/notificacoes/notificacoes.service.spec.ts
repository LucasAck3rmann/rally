// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from "@nestjs/common";
import { NotificacaoTipo } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "./notificacoes.service";

const AGORA = new Date("2026-06-16T13:00:00.000Z");

function notificacao(extras: Record<string, unknown> = {}) {
  return {
    id: "n1",
    tipo: NotificacaoTipo.PAGAMENTO,
    titulo: "Pagamento confirmado",
    corpo: "Arena Beira-Rio · Quadra 1 — 16/06, 19:00",
    destino: "/reservas/r1/confirmacao",
    lidaEm: null,
    createdAt: AGORA,
    ...extras,
  };
}

function servico(opcoes: {
  itens?: unknown[];
  naoLidas?: number;
  atualizadas?: number;
  existe?: number;
  erroAoCriar?: unknown;
} = {}) {
  const updateMany = jest
    .fn()
    .mockResolvedValue({ count: opcoes.atualizadas ?? 1 });
  const create = opcoes.erroAoCriar
    ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
    : jest.fn().mockResolvedValue(notificacao());
  // `count` serve a dois propósitos: contar não lidas (sem `id` no filtro) e
  // conferir se uma notificação existe (com `id`). Decidir pelo filtro, e não
  // pela ordem das chamadas, deixa o mock independente do teste.
  const count = jest.fn(async (args: { where: { id?: string } }) =>
    args.where.id === undefined ? (opcoes.naoLidas ?? 0) : (opcoes.existe ?? 0),
  );

  const prisma = {
    notificacao: {
      findMany: jest.fn().mockResolvedValue(opcoes.itens ?? []),
      count,
      updateMany,
      create,
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  return { servico: new NotificacoesService(prisma), updateMany, create };
}

describe("NotificacoesService", () => {
  it("lista os avisos com a contagem de não lidas", async () => {
    const { servico: s } = servico({
      itens: [notificacao(), notificacao({ id: "n2", lidaEm: AGORA })],
      naoLidas: 1,
    });

    const saida = await s.minhas("u1");

    expect(saida.naoLidas).toBe(1);
    expect(saida.itens).toHaveLength(2);
    expect(saida.itens[0].lida).toBe(false);
    expect(saida.itens[1].lida).toBe(true);
  });

  it("marca como lida filtrando pelo dono", async () => {
    const { servico: s, updateMany } = servico({ atualizadas: 1 });

    await s.marcarLida("n1", "u1");

    // O dono vai no `where` do próprio update: sem isso daria para marcar (e
    // descobrir) a notificação de outro cliente.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "n1", usuarioId: "u1" }),
      }),
    );
  });

  it("não revela a notificação de outro cliente", async () => {
    const { servico: s } = servico({ atualizadas: 0, existe: 0 });

    await expect(s.marcarLida("n1", "u2")).rejects.toThrow(NotFoundException);
  });

  it("aceita marcar de novo algo que já estava lido", async () => {
    // O update não acha nada porque já tem `lidaEm`, mas a notificação existe:
    // tocar duas vezes não é erro.
    const { servico: s } = servico({ atualizadas: 0, existe: 1 });

    await expect(s.marcarLida("n1", "u1")).resolves.toEqual({ ok: true });
  });

  it("lê todas de uma vez", async () => {
    const { servico: s, updateMany } = servico({ atualizadas: 3 });

    const saida = await s.lerTodas("u1");

    expect(saida).toEqual({ marcadas: 3 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: "u1", lidaEm: null },
      }),
    );
  });

  it("não deixa uma falha no aviso derrubar a operação que o gerou", async () => {
    // Um pagamento confirmado não pode virar erro porque a notificação falhou.
    const { servico: s } = servico({ erroAoCriar: new Error("banco fora") });

    await expect(
      s.registrar({
        usuarioId: "u1",
        tipo: NotificacaoTipo.PAGAMENTO,
        titulo: "Pagamento confirmado",
        corpo: "qualquer",
      }),
    ).resolves.toBeUndefined();
  });
});
