// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsISO8601, IsOptional, IsString } from "class-validator";

/**
 * Mover uma reserva na agenda do painel (RF-21).
 *
 * Não é a remarcação do cliente. O cliente remarca **a reserva dele**,
 * dentro da janela da política (RN-02) e na mesma quadra. Aqui quem move é
 * o dono da arena, e os dois casos que motivam a ação — quadra alagada,
 * manutenção que apareceu — exigem justamente o que o cliente não pode:
 * **trocar de quadra** e **mover fora do prazo de remarcação**.
 */
export class MoverReservaDto {
  /** Omitido, a reserva fica na quadra em que já está. */
  @IsOptional()
  @IsString()
  quadraId?: string;

  /** Instante inicial em ISO-8601, com fuso — o mesmo formato da reserva. */
  @IsISO8601()
  inicio!: string;

  @IsISO8601()
  fim!: string;
}
