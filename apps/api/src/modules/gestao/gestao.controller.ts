// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JwtPayload } from "../auth/types/jwt-payload";
import { GestaoService } from "./gestao.service";

/** Porta de entrada do painel: o que este usuário administra. */
@Controller("gestao")
@UseGuards(JwtAuthGuard)
export class GestaoController {
  constructor(private readonly gestao: GestaoService) {}

  @Get("estabelecimentos")
  meusEstabelecimentos(@CurrentUser() usuario: JwtPayload) {
    return this.gestao.meusEstabelecimentos(usuario.sub);
  }
}
