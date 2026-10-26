// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";

import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { AuditoriaService } from "../auditoria/auditoria.service";

/**
 * Leitura da trilha de auditoria (RN-05).
 *
 * **Só o administrador lê**, e esta é a única rota de leitura da gestão com
 * essa restrição. O resto do painel é de toda a equipe com vínculo — é o
 * financeiro quem mais usa os relatórios, e ele não é admin. Aqui a regra se
 * inverte porque a trilha existe para o **controle sobre a delegação**: quem
 * recebeu acesso de balcão não deveria poder auditar quem o audita.
 *
 * A rota não escreve nem apaga, e não há rota para apagar. Registro de
 * auditoria que se apaga não é registro de auditoria — é a única tabela do
 * projeto sem expurgo, por natureza.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/auditoria")
@UseGuards(JwtAuthGuard, PapelGuard)
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @Papeis(Role.ADMIN)
  listar(@Param("estabelecimentoId") estabelecimentoId: string, @Query("limite") limite?: string) {
    // O teto fica no serviço: a trilha cresce para sempre, e um `limite`
    // sem limite viraria uma leitura de tabela inteira pela URL.
    return this.auditoria.listar(estabelecimentoId, Number(limite ?? 100));
  }
}
