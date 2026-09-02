// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { QuadrasController } from "./quadras.controller";
import { QuadrasService } from "./quadras.service";

@Module({
  controllers: [QuadrasController],
  providers: [QuadrasService],
  exports: [QuadrasService],
})
export class QuadrasModule {}
