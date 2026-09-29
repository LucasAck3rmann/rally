// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelarReservaDto {
  /** Texto livre do cliente; vai para o histórico da reserva. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
