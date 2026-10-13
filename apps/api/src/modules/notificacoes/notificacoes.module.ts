// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { EmailDevProvider } from "./email-dev.provider";
import { EMAIL_PROVIDER } from "./email-provider";
import { NotificacoesController } from "./notificacoes.controller";
import { NotificacoesService } from "./notificacoes.service";

/**
 * Avisos do cliente. O e-mail fica atrás de {@link EMAIL_PROVIDER}: trocar o
 * provedor de desenvolvimento pela mensageria da nuvem é substituir este
 * `useClass`, como já acontece no Pix.
 */
@Module({
  imports: [AuthModule],
  controllers: [NotificacoesController],
  providers: [
    NotificacoesService,
    { provide: EMAIL_PROVIDER, useClass: EmailDevProvider },
  ],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
