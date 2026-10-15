// SPDX-License-Identifier: AGPL-3.0-or-later
/** Conteúdo do JWT de acesso. */
export interface JwtPayload {
  sub: string; // id do usuário
  email: string;
}
