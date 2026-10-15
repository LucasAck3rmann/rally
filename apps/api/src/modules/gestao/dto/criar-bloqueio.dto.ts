// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Bloqueio de horário na agenda (RF-21, RN-09).
 *
 * Bloqueio é uma `Reserva` com status `BLOQUEIO`, sem cliente e com preço
 * zero: ele ocupa o slot e **não gera cobrança**. Modelar como entidade
 * separada obrigaria a exclusion constraint a olhar duas tabelas, e a trava
 * contra overbooking deixaria de valer entre reserva e bloqueio.
 */
export class CriarBloqueioDto {
  @IsString()
  quadraId!: string;

  /** Instante inicial em ISO-8601, com fuso — o mesmo formato da reserva. */
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;

  /** "Manutenção da rede", "Torneio interno". Aparece na agenda. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
