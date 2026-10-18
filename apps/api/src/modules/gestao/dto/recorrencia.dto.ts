// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * Criação de uma série de mensalista (ADR-0014, RF-35).
 *
 * **Os campos que definem o horário não aparecem em nenhum DTO de edição, e
 * isso é a decisão que o ADR-0014 deixou em aberto.** Alterar a quadra, o dia
 * ou a hora de uma série que já materializou ocorrências significaria cancelar
 * N reservas e criar N outras, cada uma podendo colidir — o resultado seria uma
 * série movida pela metade, e o gestor não teria como saber quais semanas
 * mudaram. Em vez disso, **a série se encerra e se cria outra**: as ocorrências
 * passadas ficam como histórico do relatório, as futuras são canceladas com
 * motivo, e a série nova materializa com o próprio relatório de colisão.
 *
 * O ganho é uma propriedade forte: **nenhuma reserva pode discordar da série
 * que a gerou**, porque a regra que a gerou nunca muda.
 */
export class CriarRecorrenciaDto {
  @IsString()
  quadraId!: string;

  @IsString()
  clienteId!: string;

  /** 0 = domingo, como `Date.getUTCDay` e os horários de funcionamento. */
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana!: number;

  /** "19:00", na hora local do estabelecimento. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "horaInicio precisa estar no formato HH:MM.",
  })
  horaInicio!: string;

  @IsInt()
  @Min(30)
  @Max(480)
  duracaoMinutos!: number;

  /** Data-calendário "YYYY-MM-DD" a partir da qual a série vale. */
  @IsISO8601()
  vigenciaInicio!: string;

  /** Sem fim definido, o horizonte segue avançando. */
  @IsOptional()
  @IsISO8601()
  vigenciaFim?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preco!: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  observacao?: string;
}

/**
 * O que pode mudar numa série em andamento.
 *
 * Só o que **não** altera o horário das ocorrências já geradas. Reajuste de
 * preço vale para as próximas, porque o preço fica congelado em cada reserva
 * (RN-12) — e isso precisa estar visível para o gestor, senão ele reajusta e
 * não entende por que o mês seguinte não mudou.
 */
export class EditarRecorrenciaDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  preco?: number;

  @IsOptional()
  @IsISO8601()
  vigenciaFim?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  observacao?: string;
}
