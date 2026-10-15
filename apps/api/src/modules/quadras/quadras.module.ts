// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { ConciliacaoModule } from "../conciliacao/conciliacao.module";
import { QuadrasController } from "./quadras.controller";
import { QuadrasService } from "./quadras.service";

@Module({
  imports: [ConciliacaoModule],
  controllers: [QuadrasController],
  providers: [QuadrasService],
  exports: [QuadrasService],
})
export class QuadrasModule {}
