// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsIn, IsOptional } from "class-validator";

import { PeriodoReplay } from "../replays.service";

export class ListarReplaysDto {
  @IsOptional()
  @IsIn(["semana", "mes", "todos"])
  periodo?: PeriodoReplay;
}
