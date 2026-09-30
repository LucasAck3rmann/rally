// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { AtualizarQuadraDto } from "./dto/atualizar-quadra.dto";
import { CriarQuadraDto } from "./dto/criar-quadra.dto";
import { QuadrasGestaoService } from "./quadras-gestao.service";

/**
 * Cadastro e edição de quadras (RF-20).
 *
 * O estabelecimento vive na rota e o `PapelGuard` confere o vínculo do usuário
 * com ele. Ler é permitido a toda a equipe; **escrever é só do admin** — um
 * atendente não mexe em preço.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/quadras")
@UseGuards(JwtAuthGuard, PapelGuard)
export class QuadrasGestaoController {
  constructor(private readonly quadras: QuadrasGestaoService) {}

  @Get()
  listar(@Param("estabelecimentoId") estabelecimentoId: string) {
    return this.quadras.listar(estabelecimentoId);
  }

  @Get(":quadraId")
  detalhe(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("quadraId") quadraId: string,
  ) {
    return this.quadras.detalhe(estabelecimentoId, quadraId);
  }

  @Post()
  @Papeis(Role.ADMIN)
  criar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Body() dto: CriarQuadraDto,
  ) {
    return this.quadras.criar(estabelecimentoId, dto);
  }

  @Patch(":quadraId")
  @Papeis(Role.ADMIN)
  atualizar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("quadraId") quadraId: string,
    @Body() dto: AtualizarQuadraDto,
  ) {
    return this.quadras.atualizar(estabelecimentoId, quadraId, dto);
  }
}
