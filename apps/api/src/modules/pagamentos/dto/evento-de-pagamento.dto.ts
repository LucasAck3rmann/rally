// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/**
 * Eventos que o Rally **sabe aplicar**.
 *
 * A lista é curta de propósito. Um gateway publica dezenas de tipos, e tratar
 * só os que têm consequência no domínio é o que mantém a rota pequena. O que
 * não está aqui é respondido com 200 e ignorado — ver o motivo no serviço.
 *
 * **Só `pagamento.pago`, e as duas ausências são decisões.**
 *
 * `pagamento.estornado` fica de fora porque estorno é o RF-15, que não tem
 * comportamento no sistema. Aceitá-lo faria a rota prometer um tratamento
 * que não existe, e o lugar de dizer isso é esta ausência, não um `TODO`.
 *
 * `pagamento.expirado` fica de fora por outra razão, mais interessante: **o
 * sistema já expira Pix pelo próprio relógio**, em `expirarPendentes`, que
 * cancela a reserva e libera o horário. Tratar o evento aqui criaria um
 * segundo caminho para a mesma transição, e dois caminhos para uma transição
 * é como duas verdades começam — a daqui iria divergir da outra no dia em
 * que uma das duas ganhasse uma regra nova. O que o webhook adicionaria é
 * **promptidão**, não capacidade, e esse ganho não paga o risco enquanto o
 * relógio cobre o caso.
 */
export const EVENTOS_TRATADOS = ["pagamento.pago"] as const;

export class EventoDePagamentoDto {
  /**
   * Identificador da cobrança **no gateway**.
   *
   * É a chave pela qual o pagamento é encontrado, e por isso a coluna
   * `Pagamento.gatewayId` é `@unique` no esquema: duas cobranças com o mesmo
   * identificador tornariam ambíguo qual reserva confirmar, e a ambiguidade
   * seria resolvida silenciosamente pelo primeiro resultado da consulta.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  gatewayId!: string;

  /** O que aconteceu com a cobrança. */
  @IsString()
  @MaxLength(80)
  evento!: string;

  /**
   * Identificador do próprio evento no gateway, quando ele manda um.
   *
   * Não é usado para idempotência — ela é resolvida pelo **estado do
   * pagamento**, que é mais forte: um identificador de evento só protege
   * contra a reentrega do *mesmo* evento, enquanto o estado protege também
   * contra dois eventos diferentes que pedem a mesma transição. Fica
   * registrado no log para quem for investigar uma entrega.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  eventoId?: string;
}

/*
 * Nota sobre o que **não** está aqui: não há `@IsIn(EVENTOS_TRATADOS)` no
 * campo `evento`. Seria o reflexo natural, e estaria errado — o `@IsIn`
 * devolveria **400** para um tipo que o gateway publica e nós não tratamos,
 * e 4xx faz o gateway reentregar ou marcar a entrega como falha permanente.
 * Nenhum dos dois é o que queremos dizer: queremos dizer "recebi, não se
 * aplica". Isso é 200, e quem decide é o serviço.
 */
