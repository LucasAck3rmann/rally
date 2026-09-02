// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JwtPayload } from "../auth/types/jwt-payload";
import { ListarReplaysDto } from "./dto/listar-replays.dto";
import { ReplaysService } from "./replays.service";

/** Replays do cliente — o diferencial do Rally (ver Roadmap, fase 2). */
@Controller("replays")
@UseGuards(JwtAuthGuard)
export class ReplaysController {
  constructor(private readonly replays: ReplaysService) {}

  @Get("meus")
  meus(@CurrentUser() user: JwtPayload, @Query() query: ListarReplaysDto) {
    return this.replays.meus(user.sub, query.periodo ?? "semana");
  }
}
