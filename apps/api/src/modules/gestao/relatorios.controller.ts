// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Header, Param, Query, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { Res } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { RelatoriosService } from "./relatorios.service";

/**
 * Relatórios (RF-27) e exportação (RF-28).
 *
 * Sem `@Papeis`: ler relatório é de toda a equipe com vínculo — é o
 * financeiro quem mais usa, e ele não é admin. O `PapelGuard` já barra quem
 * não tem vínculo nenhum, com 404.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/relatorios")
@UseGuards(JwtAuthGuard, PapelGuard)
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get()
  relatorio(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Query("de") de: string,
    @Query("ate") ate: string,
  ) {
    return this.relatorios.relatorio(estabelecimentoId, de, ate);
  }

  @Get("csv")
  @Header("Cache-Control", "no-store")
  async csv(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Query("de") de: string,
    @Query("ate") ate: string,
    @Res() resposta: Response,
  ) {
    const { arquivo, conteudo } = await this.relatorios.csv(
      estabelecimentoId,
      de,
      ate,
    );

    // `charset=utf-8` junto do BOM: o cabeçalho orienta o navegador e o BOM
    // orienta o Excel, que ignora o cabeçalho ao abrir arquivo local.
    resposta.setHeader("Content-Type", "text/csv; charset=utf-8");
    resposta.setHeader(
      "Content-Disposition",
      `attachment; filename="${arquivo}"`,
    );
    resposta.send(conteudo);
  }

  @Get("xlsx")
  @Header("Cache-Control", "no-store")
  async xlsx(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Query("de") de: string,
    @Query("ate") ate: string,
    @Res() resposta: Response,
  ) {
    const { arquivo, conteudo } = await this.relatorios.xlsx(
      estabelecimentoId,
      de,
      ate,
    );

    resposta.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    resposta.setHeader(
      "Content-Disposition",
      `attachment; filename="${arquivo}"`,
    );
    // `send` com Buffer e não `end`: o Express põe o Content-Length, e sem
    // ele o navegador não mostra progresso num arquivo que pode crescer.
    resposta.send(conteudo);
  }
}
