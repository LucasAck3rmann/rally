// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { Auditar } from "../auditoria/auditar.decorator";
import { AuditoriaInterceptor } from "../auditoria/auditoria.interceptor";
import { CuponsService } from "./cupons.service";
import { AtualizarCupomDto, CriarCupomDto } from "./dto/cupom-gestao.dto";

/**
 * Cupons do estabelecimento (RF-25).
 *
 * **Ver é de toda a equipe** — o atendente precisa saber se o cupom que o
 * cliente mostrou no balcão ainda vale. **Criar e editar é do admin**: cupom
 * é decisão de preço, e um desconto errado sai do faturamento.
 *
 * Não há rota de apagar, de propósito: cupom usado está apontado por
 * `Reserva.promocaoId`, e apagá-lo faria sumir a origem do desconto de uma
 * reserva paga. Desligar é `PATCH` com `ativo: false`.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/cupons")
@UseGuards(JwtAuthGuard, PapelGuard)
@UseInterceptors(AuditoriaInterceptor)
export class CuponsController {
  constructor(private readonly cupons: CuponsService) {}

  @Get()
  listar(@Param("estabelecimentoId") estabelecimentoId: string) {
    return this.cupons.listar(estabelecimentoId);
  }

  @Post()
  @Auditar({ acao: "criar cupom", entidade: "Promocao" })
  @Papeis(Role.ADMIN)
  criar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Body() dto: CriarCupomDto,
  ) {
    return this.cupons.criar(estabelecimentoId, dto);
  }

  @Patch(":cupomId")
  @Auditar({ acao: "editar cupom", entidade: "Promocao", parametro: "cupomId" })
  @Papeis(Role.ADMIN)
  atualizar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("cupomId") cupomId: string,
    @Body() dto: AtualizarCupomDto,
  ) {
    return this.cupons.atualizar(estabelecimentoId, cupomId, dto);
  }
}
