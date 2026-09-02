// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PromocoesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Promoção em destaque na Home do app: a mais recente que está no ar,
   * dentro da validade e com usos disponíveis. `null` quando não há nenhuma.
   */
  async destaque() {
    const agora = new Date();
    const promocoes = await this.prisma.promocao.findMany({
      where: {
        ativo: true,
        validadeInicio: { lte: agora },
        validadeFim: { gte: agora },
        estabelecimento: { ativo: true },
      },
      select: {
        codigo: true,
        tipo: true,
        valor: true,
        usosMax: true,
        usosFeitos: true,
        estabelecimento: { select: { nome: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const disponivel = promocoes.find((p) => p.usosMax === null || p.usosFeitos < p.usosMax);
    if (!disponivel) return null;

    const valor = Number(disponivel.valor);
    const percentual = disponivel.tipo === "PERCENTUAL";

    return {
      codigo: disponivel.codigo,
      // Texto pronto para a tela — a regra de formatação mora aqui, não na UI.
      titulo: percentual
        ? `Primeira hora com ${valor.toFixed(0)}% OFF`
        : `R$ ${valor.toFixed(0)} de desconto na primeira hora`,
      chamada: `Use o cupom ${disponivel.codigo}`,
      selo: percentual ? "%" : "R$",
      estabelecimento: disponivel.estabelecimento.nome,
    };
  }
}
