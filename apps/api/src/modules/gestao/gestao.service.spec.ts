// SPDX-License-Identifier: AGPL-3.0-or-later
import { Role } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PAPEIS_DE_GESTAO } from "../auth/decorators/papeis.decorator";
import { GestaoService } from "./gestao.service";

function vinculo(role: Role) {
  return {
    role,
    estabelecimento: {
      id: "e1",
      nome: "Arena Beira-Rio",
      slug: "arena-beira-rio",
      cidade: "Sapiranga",
      uf: "RS",
      plano: "FREE",
      ativo: true,
      _count: { quadras: 3 },
    },
  };
}

function servico(vinculos: unknown[] = [vinculo(Role.ADMIN)]) {
  const prisma = {
    membership: { findMany: jest.fn().mockResolvedValue(vinculos) },
  } as unknown as PrismaService & Record<string, never>;
  return { servico: new GestaoService(prisma), prisma };
}

describe("GestaoService.meusEstabelecimentos", () => {
  it("devolve a arena com o papel do vínculo", async () => {
    const { servico: s } = servico();
    const [arena] = await s.meusEstabelecimentos("u1");

    expect(arena).toMatchObject({
      id: "e1",
      nome: "Arena Beira-Rio",
      quadras: 3,
      meuPapel: Role.ADMIN,
    });
  });

  it("filtra pelos mesmos papéis que o guard deixa entrar", async () => {
    // Antes o filtro era "tudo que não é CLIENTE", e a diferença aparecia no
    // MANTENEDOR: ele passava aqui, a arena aparecia na barra lateral, e toda
    // seção que ele abrisse devolvia 403. Listar o que não dá para abrir é
    // pior do que não listar — vira um painel que parece quebrado.
    const { servico: s, prisma } = servico();
    await s.meusEstabelecimentos("u1");

    expect((prisma.membership.findMany as jest.Mock).mock.calls[0][0].where).toEqual({
      usuarioId: "u1",
      role: { in: PAPEIS_DE_GESTAO },
    });
  });

  it("os papéis listados são exatamente os de gestão da arena", async () => {
    // Amarra a constante ao significado: MANTENEDOR é papel da plataforma e
    // CLIENTE é de quem só joga; nenhum dos dois administra arena.
    expect(PAPEIS_DE_GESTAO).toEqual([Role.ADMIN, Role.ATENDENTE, Role.FINANCEIRO]);
    expect(PAPEIS_DE_GESTAO).not.toContain(Role.MANTENEDOR);
    expect(PAPEIS_DE_GESTAO).not.toContain(Role.CLIENTE);
  });

  it("sem vínculo de gestão, a lista volta vazia em vez de dar erro", async () => {
    // É o que o mantenedor da plataforma passa a ver: um painel vazio, que é
    // honesto, no lugar de uma arena que não abre.
    const { servico: s } = servico([]);
    await expect(s.meusEstabelecimentos("u1")).resolves.toEqual([]);
  });
});
