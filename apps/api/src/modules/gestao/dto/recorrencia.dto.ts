// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  IsEmail,
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

  /**
   * E-mail de quem tem o horário, e não o identificador.
   *
   * **O painel é preenchido por uma pessoa, e ninguém sabe o UUID de
   * ninguém.** O caminho é o mesmo que a equipe já usa (RF-23): quem não tem
   * conta no Rally recebe 404 com o motivo, e a tela manda pedir o cadastro.
   * Convite pendente exigiria token e e-mail transacional — dois recursos que
   * o MVP não tem, e o ADR-0014 não precisa deles para entregar o controle.
   */
  @IsEmail({}, { message: "Informe um e-mail válido para o cliente." })
  clienteEmail!: string;

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
