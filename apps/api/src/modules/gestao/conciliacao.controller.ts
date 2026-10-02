// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";

import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { ConciliacaoService } from "../conciliacao/conciliacao.service";

/**
 * Conciliação reserva × pagamento (RF-29).
 *
 * Ler é de toda a equipe com vínculo: é o financeiro quem concilia, e ele
 * não é admin. **Liberar horário expirado escreve**, e escrita de agenda é
 * do admin — mesma fronteira do bloqueio.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/conciliacao")
@UseGuards(JwtAuthGuard, PapelGuard)
export class ConciliacaoController {
  constructor(private readonly conciliacao: ConciliacaoService) {}

  @Get()
  relatorio(@Param("estabelecimentoId") estabelecimentoId: string) {
    return this.conciliacao.relatorio(estabelecimentoId);
  }

  @Post("expirar-pendentes")
  @Papeis(Role.ADMIN)
  async expirar(@Param("estabelecimentoId") estabelecimentoId: string) {
    const liberadas = await this.conciliacao.expirarPendentes({
      estabelecimentoId,
    });
    return { liberadas };
  }
}
