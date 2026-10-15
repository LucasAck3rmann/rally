// SPDX-License-Identifier: AGPL-3.0-or-later
import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";

import { EventoDePagamentoDto } from "./dto/evento-de-pagamento.dto";
import { SegredoDeWebhookGuard } from "./guards/segredo-de-webhook.guard";
import { PagamentosService } from "./pagamentos.service";

/**
 * Entrada dos eventos do gateway de pagamento (RNF-10, RF-13).
 *
 * Fora das rotas de cliente, como a ingestão de replay e pela mesma razão:
 * quem chama é máquina, a autenticação é por segredo compartilhado e a
 * resposta é idempotente.
 *
 * **Não há `@UseInterceptors(AuditoriaInterceptor)` aqui, e é decisão.** A
 * trilha de auditoria responde "quem **da equipe** fez o quê" — é uma
 * pergunta de delegação. Um evento de gateway não tem autor humano, e
 * registrá-lo encheria a trilha do dono de linhas sem responsável. O rastro
 * deste caminho é o `Pagamento` em si, que guarda `gatewayId` e `pagoEm`, e
 * o log do servidor para o que não virou transição.
 */
@Controller("integracoes/pagamentos")
@UseGuards(SegredoDeWebhookGuard)
export class PagamentosController {
  constructor(private readonly pagamentos: PagamentosService) {}

  /**
   * `200` em vez do `201` padrão do Nest para `@Post`.
   *
   * Não é cosmético: gateway trata a faixa 2xx como entregue, mas um `201
   * Created` diz "criei um recurso", e o que esta rota faz é **aplicar um
   * evento** — muitas vezes sem criar nada, porque já estava aplicado.
   */
  @Post("webhook")
  @HttpCode(200)
  webhook(@Body() dto: EventoDePagamentoDto) {
    return this.pagamentos.aplicarEvento(dto);
  }
}
