// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { PainelService } from "./painel.service";

/**
 * Painel de ocupação, receita e próximos jogos (RF-22).
 *
 * Sem `@Papeis`: ler o painel é de toda a equipe com vínculo. O atendente
 * precisa saber quanto falta para fechar o dia tanto quanto o dono — e o
 * `PapelGuard` já barra quem não tem vínculo nenhum, com 404.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/painel")
@UseGuards(JwtAuthGuard, PapelGuard)
export class PainelController {
  constructor(private readonly painel: PainelService) {}

  @Get()
  resumo(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Query("dias") dias?: string,
  ) {
    // 7 dias é a janela que o dono olha: a semana que está acontecendo.
    return this.painel.resumo(estabelecimentoId, Number(dias ?? 7));
  }
}
