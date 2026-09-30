// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { JwtPayload } from "../auth/types/jwt-payload";
import { AdicionarMembroDto, TrocarPapelDto } from "./dto/equipe.dto";
import { EquipeService } from "./equipe.service";

/**
 * Equipe do estabelecimento (RF-23).
 *
 * **Ver quem é a equipe é de toda a equipe** — saber a quem recorrer não é
 * privilégio. **Mexer é só do admin**: quem dá e tira acesso decide quem
 * mexe em preço e em agenda.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/equipe")
@UseGuards(JwtAuthGuard, PapelGuard)
export class EquipeController {
  constructor(private readonly equipe: EquipeService) {}

  @Get()
  listar(@Param("estabelecimentoId") estabelecimentoId: string) {
    return this.equipe.listar(estabelecimentoId);
  }

  @Post()
  @Papeis(Role.ADMIN)
  adicionar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Body() dto: AdicionarMembroDto,
  ) {
    return this.equipe.adicionar(estabelecimentoId, dto.email, dto.papel);
  }

  @Patch(":usuarioId")
  @Papeis(Role.ADMIN)
  trocarPapel(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("usuarioId") usuarioId: string,
    @Body() dto: TrocarPapelDto,
    @CurrentUser() usuario: JwtPayload,
  ) {
    // Quem pediu importa: rebaixar a si mesmo sendo o único admin tranca a
    // arena, e a mensagem de recusa precisa dizer isso com todas as letras.
    return this.equipe.trocarPapel(
      estabelecimentoId,
      usuarioId,
      dto.papel,
      usuario.sub,
    );
  }

  @Delete(":usuarioId")
  @Papeis(Role.ADMIN)
  remover(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("usuarioId") usuarioId: string,
    @CurrentUser() usuario: JwtPayload,
  ) {
    return this.equipe.remover(estabelecimentoId, usuarioId, usuario.sub);
  }
}
