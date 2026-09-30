// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { GestaoController } from "./gestao.controller";
import { GestaoService } from "./gestao.service";
import { QuadrasGestaoController } from "./quadras-gestao.controller";
import { QuadrasGestaoService } from "./quadras-gestao.service";

/** Lado do dono: o que o painel do estabelecimento consome. */
@Module({
  imports: [AuthModule],
  controllers: [GestaoController, QuadrasGestaoController],
  providers: [GestaoService, QuadrasGestaoService],
})
export class GestaoModule {}
