// SPDX-License-Identifier: AGPL-3.0-or-later
import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { RequisicaoDeGestao, Vinculo } from "../types/requisicao-de-gestao";

/** Injeta o vínculo resolvido pelo `PapelGuard` (papel + estabelecimento). */
export const VinculoAtual = createParamDecorator(
  (_dados: unknown, ctx: ExecutionContext): Vinculo => {
    return ctx.switchToHttp().getRequest<RequisicaoDeGestao>().vinculo;
  },
);
