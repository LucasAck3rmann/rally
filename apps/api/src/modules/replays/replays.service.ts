// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from "@nestjs/common";
import { ReplayStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/** Janelas do filtro da tela de Replays (chips "Esta semana / Este mês / Todos"). */
export type PeriodoReplay = "semana" | "mes" | "todos";

@Injectable()
export class ReplaysService {
  constructor(private readonly prisma: PrismaService) {}

  /** Clipes prontos do cliente logado, do mais recente para o mais antigo. */
  async meus(usuarioId: string, periodo: PeriodoReplay) {
    const desde = this.inicioDoPeriodo(periodo);

    const replays = await this.prisma.replay.findMany({
      where: {
        clienteId: usuarioId,
        status: ReplayStatus.PRONTO,
        ...(desde ? { criadoEm: { gte: desde } } : {}),
        OR: [{ expiraEm: null }, { expiraEm: { gt: new Date() } }],
      },
      select: {
        id: true,
        url: true,
        duracaoSeg: true,
        criadoEm: true,
        quadra: {
          select: {
            nome: true,
            fotos: true,
            estabelecimento: { select: { nome: true, timezone: true } },
          },
        },
      },
      orderBy: { criadoEm: "desc" },
      take: 50,
    });

    return replays.map((r) => ({
      id: r.id,
      // O título editorial vem do clipe; enquanto não há edição, usa a quadra.
      titulo: r.quadra.nome,
      url: r.url,
      thumbUrl: r.quadra.fotos[0] ?? null,
      duracaoSeg: r.duracaoSeg,
      criadoEm: r.criadoEm.toISOString(),
      estabelecimento: r.quadra.estabelecimento.nome,
    }));
  }

  private inicioDoPeriodo(periodo: PeriodoReplay): Date | null {
    if (periodo === "todos") return null;
    const dias = periodo === "semana" ? 7 : 30;
    return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  }
}
