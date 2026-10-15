// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { LembreteDeJogoJob } from "./lembrete.job";
import { LembreteService } from "./lembrete.service";
import { NotificacoesController } from "./notificacoes.controller";
import { NotificacoesService } from "./notificacoes.service";

/** Avisos do cliente, in-app e por e-mail (RF-16). */
@Module({
  imports: [AuthModule, EmailModule],
  controllers: [NotificacoesController],
  providers: [NotificacoesService, LembreteService, LembreteDeJogoJob],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
