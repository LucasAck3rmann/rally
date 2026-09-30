// SPDX-License-Identifier: AGPL-3.0-or-later
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import { FaixaPrecoDto } from "./faixa-preco.dto";

/**
 * Edição de quadra (RF-20). Todo campo é opcional: o que não vier fica como
 * está. Listas (`modalidades`, `comodidades`, `fotos`, `faixasPreco`) são
 * **substituídas por inteiro** quando informadas.
 */
export class AtualizarQuadraDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  precoHora?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacidade?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  modalidades?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  comodidades?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  fotos?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => FaixaPrecoDto)
  faixasPreco?: FaixaPrecoDto[];

  /** `false` tira a quadra da vitrine sem apagar o histórico ("pausar"). */
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
