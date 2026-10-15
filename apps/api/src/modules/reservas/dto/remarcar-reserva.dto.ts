// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsDateString } from "class-validator";

/** Novo horário pedido para uma reserva existente (RF-09). */
export class RemarcarReservaDto {
  @IsDateString()
  inicio!: string;

  @IsDateString()
  fim!: string;
}
