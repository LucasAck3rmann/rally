import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
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
}
