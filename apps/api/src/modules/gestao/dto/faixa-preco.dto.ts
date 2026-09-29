// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsInt, IsNumber, IsOptional, Matches, Max, Min } from "class-validator";

/** Preço diferenciado numa janela do dia (ex.: horário nobre 18h–23h). */
export class FaixaPrecoDto {
  /**
   * 0 = domingo … 6 = sábado. Ausente vale para todos os dias.
   *
   * O tipo admite `null` de propósito: `@IsOptional()` do class-validator
   * ignora **os dois**, `null` e `undefined`, e o `whitelist` não remove uma
   * propriedade que o DTO declara — então `{"diaSemana": null}` chega inteiro
   * no serviço. No banco a coluna é `Int?`, e `null` ali significa exatamente
   * "todos os dias". Fingir no tipo que só `undefined` chega foi o que deixou
   * a validação de sobreposição passar por fora.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number | null;

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
