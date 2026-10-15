// SPDX-License-Identifier: AGPL-3.0-or-later
import { Role } from "@prisma/client";
import { Request } from "express";

/** Vínculo do usuário logado com o estabelecimento da rota. */
export interface Vinculo {
  id: string;
  role: Role;
  estabelecimentoId: string;
}

/** Requisição já passada pelo `JwtAuthGuard` e pelo `PapelGuard`. */
export interface RequisicaoDeGestao extends Request {
  vinculo: Vinculo;
}
