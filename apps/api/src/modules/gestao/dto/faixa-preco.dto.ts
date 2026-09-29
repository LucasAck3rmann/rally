// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsInt, IsNumber, IsOptional, Matches, Max, Min } from "class-validator";

/** Preço diferenciado numa janela do dia (ex.: horário nobre 18h–23h). */
export class FaixaPrecoDto {
  /** 0 = domingo … 6 = sábado. Ausente vale para todos os dias. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "horaInicio deve estar no formato HH:mm",
  })
  horaInicio!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "horaFim deve estar no formato HH:mm",
  })
  horaFim!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  precoHora!: number;
}
