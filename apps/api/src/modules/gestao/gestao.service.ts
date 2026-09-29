// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class GestaoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estabelecimentos que o usuário administra — é o que alimenta o seletor de
   * estabelecimento da barra lateral do painel.
   *
   * O vínculo de cliente fica de fora: quem só joga numa arena não gerencia
   * coisa nenhuma nela.
   */
  async meusEstabelecimentos(usuarioId: string) {
    const vinculos = await this.prisma.membership.findMany({
      where: { usuarioId, role: { not: Role.CLIENTE } },
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
