// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from "@nestjs/common";

import { PAPEIS_DE_GESTAO } from "../auth/decorators/papeis.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GestaoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estabelecimentos que o usuário administra — é o que alimenta o seletor de
   * estabelecimento da barra lateral do painel.
   *
   * Filtra pelos **mesmos papéis que o `PapelGuard` deixa entrar**, e não por
   * "tudo que não é cliente". A diferença aparecia no `MANTENEDOR`: ele é
   * papel da plataforma (nível SaaS), o `PAPEIS_DE_GESTAO` não o inclui e o
   * guard o recusa em toda rota de arena — mas ele passava neste filtro, e a
   * arena aparecia na barra lateral para alguém que levaria 403 em cada
   * seção que abrisse. Listar o que não dá para abrir é pior do que não
   * listar: vira um painel que parece quebrado.
   *
   * Uma lista só, derivada da mesma constante, é o que impede os dois lados
   * de voltarem a discordar.
   */
  async meusEstabelecimentos(usuarioId: string) {
    const vinculos = await this.prisma.membership.findMany({
      where: { usuarioId, role: { in: PAPEIS_DE_GESTAO } },
      select: {
        role: true,
        estabelecimento: {
          select: {
            id: true,
            nome: true,
            slug: true,
            cidade: true,
            uf: true,
            plano: true,
            ativo: true,
            _count: { select: { quadras: true } },
          },
        },
      },
      orderBy: { estabelecimento: { nome: "asc" } },
    });

    return vinculos.map((v) => ({
      id: v.estabelecimento.id,
      nome: v.estabelecimento.nome,
      slug: v.estabelecimento.slug,
      cidade: v.estabelecimento.cidade,
      uf: v.estabelecimento.uf,
      plano: v.estabelecimento.plano,
      ativo: v.estabelecimento.ativo,
      quadras: v.estabelecimento._count.quadras,
      meuPapel: v.role,
    }));
  }
}
