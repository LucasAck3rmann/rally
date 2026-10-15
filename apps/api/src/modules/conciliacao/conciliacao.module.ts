// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { ConciliacaoService } from "./conciliacao.service";
import { ExpiracaoDePendentesJob } from "./expiracao.job";

/**
 * Módulo próprio porque o serviço tem dois consumidores com papéis
 * diferentes: a rota de gestão (RF-29) e a grade de disponibilidade, que o
 * usa como rede de segurança para liberar horário com Pix expirado
 * (RN-13). Deixá-lo dentro de `GestaoModule` faria a grade do cliente
 * depender do módulo do dono.
 *
 * O job de expiração mora aqui e **não** é exportado: ninguém deve
 * injetá-lo — quem precisa expirar chama o serviço.
 */
@Module({
  providers: [ConciliacaoService, ExpiracaoDePendentesJob],
  exports: [ConciliacaoService],
})
export class ConciliacaoModule {}
