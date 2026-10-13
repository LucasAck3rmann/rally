// SPDX-License-Identifier: AGPL-3.0-or-later
import { Logger, NotFoundException } from "@nestjs/common";
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
  erroAoEnviar?: unknown;
  usuario?: unknown;
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
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.usuario === undefined
            ? { email: "lucas@exemplo.com" }
            : opcoes.usuario,
        ),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const enviar = opcoes.erroAoEnviar
    ? jest.fn().mockRejectedValue(opcoes.erroAoEnviar)
    : jest.fn().mockResolvedValue(undefined);
  return {
    servico: new NotificacoesService(prisma, { enviar }),
    updateMany,
    create,
    enviar,
  };
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

  describe("canal de e-mail (RF-16)", () => {
    const AVISO = {
      usuarioId: "u1",
      tipo: NotificacaoTipo.PAGAMENTO,
      titulo: "Pagamento confirmado",
      corpo: "Arena · Quadra 1",
    };

    it("sem bloco de e-mail, só grava o aviso in-app", async () => {
      // Nem todo aviso merece sair do aplicativo; quem decide é quem chama.
      const { servico: s, create, enviar } = servico();
      await s.registrar(AVISO);

      expect(create).toHaveBeenCalled();
      expect(enviar).not.toHaveBeenCalled();
    });

    it("com bloco de e-mail, manda para o endereço do usuário", async () => {
      const { servico: s, enviar } = servico();
      await s.registrar({
        ...AVISO,
        email: { assunto: "Pagamento confirmado", texto: "Bom jogo!" },
      });

      expect(enviar).toHaveBeenCalledWith({
        para: "lucas@exemplo.com",
        assunto: "Pagamento confirmado",
        texto: "Bom jogo!",
      });
    });

    it("usuário sem endereço não vira erro — o aviso in-app já chegou", async () => {
      const { servico: s, create, enviar } = servico({ usuario: null });
      await s.registrar({
        ...AVISO,
        email: { assunto: "a", texto: "b" },
      });

      expect(create).toHaveBeenCalled();
      expect(enviar).not.toHaveBeenCalled();
    });

    it("falha no e-mail não derruba o que o cliente pediu", async () => {
      const aviso = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});
      const { servico: s } = servico({ erroAoEnviar: new Error("smtp fora") });

      await expect(
        s.registrar({ ...AVISO, email: { assunto: "a", texto: "b" } }),
      ).resolves.toBeUndefined();
      expect(aviso).toHaveBeenCalledWith(
        expect.stringContaining("Não foi possível enviar o e-mail"),
      );
      aviso.mockRestore();
    });

    it("falha ao gravar o aviso não engole o e-mail", async () => {
      // É a razão de os dois canais terem `try` separados. Com um só, uma
      // falha de banco levaria junto o e-mail, e o cliente ficaria sem os
      // dois — quando o certo é ficar sem o que falhou.
      const aviso = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});
      const { servico: s, enviar } = servico({
        erroAoCriar: new Error("banco fora"),
      });

      await s.registrar({ ...AVISO, email: { assunto: "a", texto: "b" } });

      expect(enviar).toHaveBeenCalled();
      aviso.mockRestore();
    });
  });
});
