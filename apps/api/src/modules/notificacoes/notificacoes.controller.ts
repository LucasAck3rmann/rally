// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JwtPayload } from "../auth/types/jwt-payload";
import { NotificacoesService } from "./notificacoes.service";

/** Notificações do cliente autenticado. */
@Controller("notificacoes")
@UseGuards(JwtAuthGuard)
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  minhas(@CurrentUser() user: JwtPayload) {
    return this.notificacoes.minhas(user.sub);
  }

  @Post("ler-todas")
  lerTodas(@CurrentUser() user: JwtPayload) {
    return this.notificacoes.lerTodas(user.sub);
  }

  @Post(":id/lida")
  marcarLida(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.notificacoes.marcarLida(id, user.sub);
  }
}
