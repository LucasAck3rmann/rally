// SPDX-License-Identifier: AGPL-3.0-or-later
import { SetMetadata } from "@nestjs/common";
import { Role } from "@prisma/client";

export const PAPEIS_EXIGIDOS = "papeis_exigidos";

/**
 * Papéis que administram um estabelecimento. `CLIENTE` é o vínculo de quem só
 * joga, e `MANTENEDOR` é da plataforma (nível SaaS) — nenhum dos dois entra
 * numa rota de gestão pela porta da frente.
 */
export const PAPEIS_DE_GESTAO: Role[] = [
  Role.ADMIN,
  Role.ATENDENTE,
  Role.FINANCEIRO,
];

/**
 * Restringe a rota aos papéis informados, avaliados **dentro do
 * estabelecimento da URL** — ninguém é "admin" globalmente (ver ADR-0011).
 * Sem o decorador, vale {@link PAPEIS_DE_GESTAO}.
 */
export const Papeis = (...papeis: Role[]) =>
  SetMetadata(PAPEIS_EXIGIDOS, papeis);
