// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { NotificacoesModule } from "../notificacoes/notificacoes.module";
import { IngestaoDeReplaysController } from "./ingestao.controller";
import { IngestaoDeReplaysService } from "./ingestao.service";
import { ReplaysController } from "./replays.controller";
import { ReplaysService } from "./replays.service";

@Module({
  imports: [AuthModule, NotificacoesModule],
  controllers: [ReplaysController, IngestaoDeReplaysController],
  providers: [ReplaysService, IngestaoDeReplaysService],
})
export class ReplaysModule {}
