import { IsIn, IsOptional } from "class-validator";

import { PeriodoReplay } from "../replays.service";

export class ListarReplaysDto {
  @IsOptional()
  @IsIn(["semana", "mes", "todos"])
  periodo?: PeriodoReplay;
}
