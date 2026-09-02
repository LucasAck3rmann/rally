// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ReplaysController } from "./replays.controller";
import { ReplaysService } from "./replays.service";

@Module({
  imports: [AuthModule],
  controllers: [ReplaysController],
  providers: [ReplaysService],
})
export class ReplaysModule {}
