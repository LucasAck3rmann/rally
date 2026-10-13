// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PrivacidadeController } from "./privacidade.controller";
import { PrivacidadeService } from "./privacidade.service";

/** Direitos do titular dos dados (RNF-07, LGPD). */
@Module({
  imports: [AuthModule],
  controllers: [PrivacidadeController],
  providers: [PrivacidadeService],
})
export class PrivacidadeModule {}
