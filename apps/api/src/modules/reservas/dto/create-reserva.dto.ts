// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { PagamentoMetodo } from "@prisma/client";

export class CreateReservaDto {
  @IsString()
  quadraId!: string;

  /** Início do slot em ISO-8601 (UTC), como devolvido por `/disponibilidade`. */
  @IsDateString()
  inicio!: string;

  @IsDateString()
  fim!: string;

  @IsOptional()
  @IsEnum(PagamentoMetodo)
  metodo?: PagamentoMetodo;

  /**
   * Código do cupom (RF-14, RN-14). Opcional, e conferido sem diferenciar
   * maiúscula de minúscula — ninguém digita cupom com o cuidado de uma senha.
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cupom?: string;
}
