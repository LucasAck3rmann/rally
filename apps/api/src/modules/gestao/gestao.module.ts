// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AgendaController } from "./agenda.controller";
import { AgendaService } from "./agenda.service";
import { GestaoController } from "./gestao.controller";
import { PainelController } from "./painel.controller";
import { PainelService } from "./painel.service";
import { GestaoService } from "./gestao.service";
import { QuadrasGestaoController } from "./quadras-gestao.controller";
import { QuadrasGestaoService } from "./quadras-gestao.service";

/** Lado do dono: o que o painel do estabelecimento consome. */
@Module({
  imports: [AuthModule],
  controllers: [GestaoController, QuadrasGestaoController, AgendaController, PainelController],
  providers: [GestaoService, QuadrasGestaoService, AgendaService, PainelService],
})
export class GestaoModule {}
