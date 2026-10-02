// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AgendaController } from "./agenda.controller";
import { ConciliacaoModule } from "../conciliacao/conciliacao.module";
import { ConciliacaoController } from "./conciliacao.controller";
import { AgendaService } from "./agenda.service";
import { EquipeController } from "./equipe.controller";
import { EquipeService } from "./equipe.service";
import { GestaoController } from "./gestao.controller";
import { PainelController } from "./painel.controller";
import { RelatoriosController } from "./relatorios.controller";
import { RelatoriosService } from "./relatorios.service";
import { PainelService } from "./painel.service";
import { GestaoService } from "./gestao.service";
import { QuadrasGestaoController } from "./quadras-gestao.controller";
import { QuadrasGestaoService } from "./quadras-gestao.service";

/** Lado do dono: o que o painel do estabelecimento consome. */
@Module({
  imports: [AuthModule, ConciliacaoModule],
  controllers: [GestaoController, QuadrasGestaoController, AgendaController, PainelController, EquipeController, RelatoriosController, ConciliacaoController],
  providers: [GestaoService, QuadrasGestaoService, AgendaService, PainelService, EquipeService, RelatoriosService],
})
export class GestaoModule {}
