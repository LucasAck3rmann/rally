// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PagamentosModule } from "../pagamentos/pagamentos.module";
import { QuadrasModule } from "../quadras/quadras.module";
import { ReservasController } from "./reservas.controller";
import { ReservasService } from "./reservas.service";

@Module({
  imports: [AuthModule, QuadrasModule, PagamentosModule],
  controllers: [ReservasController],
  providers: [ReservasService],
})
export class ReservasModule {}
