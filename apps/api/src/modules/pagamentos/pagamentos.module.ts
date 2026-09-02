// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { PagamentosService } from "./pagamentos.service";
import { PixDevProvider } from "./pix-dev.provider";
import { PIX_PROVIDER } from "./pix-provider";

/**
 * Pagamentos. Hoje só Pix, atrás da porta {@link PIX_PROVIDER}: trocar o
 * provedor de desenvolvimento pela AbacatePay é substituir este `useClass`.
 */
@Module({
  providers: [PagamentosService, { provide: PIX_PROVIDER, useClass: PixDevProvider }],
  exports: [PagamentosService],
})
export class PagamentosModule {}
