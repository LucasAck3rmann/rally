// SPDX-License-Identifier: AGPL-3.0-or-later
import { PromocaoTipo } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

/**
 * Cupom criado pelo painel (RF-25).
 *
 * O código aceita só letra e número: espaço e acento viram erro de digitação
 * na hora de usar, e um cupom que o cliente não consegue digitar não é
 * promoção, é suporte.
 */
export class CriarCupomDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: "O código aceita apenas letras e números, sem espaço nem acento.",
  })
  codigo!: string;

  @IsEnum(PromocaoTipo)
  tipo!: PromocaoTipo;

  /** Percentual quando `PERCENTUAL`; reais quando `VALOR_FIXO`. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor!: number;

  @IsISO8601()
  validadeInicio!: string;

  @IsISO8601()
  validadeFim!: string;

  /** Omitido, o cupom não tem teto de usos. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usosMax?: number;
}

/**
 * Edição de cupom (RF-25).
 *
 * O **código não entra**: ele já está impresso em cartaz e circulando no
 * grupo do WhatsApp. Trocar o texto de um cupom em uso quebraria quem o
 * recebeu, e para isso existe criar outro.
 */
export class AtualizarCupomDto {
  @IsOptional()
  @IsEnum(PromocaoTipo)
  tipo?: PromocaoTipo;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  valor?: number;

  @IsOptional()
  @IsISO8601()
  validadeInicio?: string;

  @IsOptional()
  @IsISO8601()
  validadeFim?: string;

  /** `null` tira o teto; o serviço recusa teto abaixo do já usado. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  usosMax?: number | null;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
