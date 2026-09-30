// SPDX-License-Identifier: AGPL-3.0-or-later
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  Max,
  MinLength,
  ValidateNested,
} from "class-validator";

import { FaixaPrecoDto } from "./faixa-preco.dto";

/** Cadastro de quadra pelo estabelecimento (RF-20). */
export class CriarQuadraDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  /** Preço-base por hora; as faixas sobrescrevem em janelas específicas. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  precoHora!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacidade?: number;

  /** Nomes de modalidades já cadastradas, ex.: ["Beach Tennis"]. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  modalidades!: string[];

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
}
