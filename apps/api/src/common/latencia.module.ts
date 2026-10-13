// SPDX-License-Identifier: AGPL-3.0-or-later
import { Global, Module } from "@nestjs/common";

import { Latencia } from "./latencia";

/**
 * A janela de medidas, compartilhada pelo processo inteiro.
 *
 * `@Global` porque duas instancias seriam dois resumos parciais: o
 * interceptor grava num e a rota de saude leria o outro, e o numero sairia
 * pela metade sem ninguem notar.
 */
@Global()
@Module({
  providers: [Latencia],
  exports: [Latencia],
})
export class LatenciaModule {}
