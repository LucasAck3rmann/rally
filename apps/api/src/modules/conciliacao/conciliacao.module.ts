// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { ConciliacaoService } from "./conciliacao.service";

/**
 * Módulo próprio porque o serviço tem dois consumidores com papéis
 * diferentes: a rota de gestão (RF-29) e a grade de disponibilidade, que o
 * usa para liberar horário com Pix expirado (RN-13). Deixá-lo dentro de
 * `GestaoModule` faria a grade do cliente depender do módulo do dono.
 */
@Module({
  providers: [ConciliacaoService],
  exports: [ConciliacaoService],
})
export class ConciliacaoModule {}
