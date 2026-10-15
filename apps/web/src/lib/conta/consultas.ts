// SPDX-License-Identifier: AGPL-3.0-or-later
import { cache } from "react";
import { z } from "zod";

import { chamarApiAutenticada } from "../api/autenticado";

/** O que `GET /auth/me` devolve. Validado na fronteira, como as demais. */
export const MinhaConta = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
});

export type MinhaConta = z.infer<typeof MinhaConta>;

/**
 * A conta de quem está na sessão.
 *
 * Em `cache()` pelo mesmo motivo de `meusEstabelecimentos`: mais de um ponto
 * da mesma renderização pode querer o e-mail, e sem isso cada um faria a
 * própria chamada.
 */
export const minhaConta = cache(() => chamarApiAutenticada("/auth/me", MinhaConta));
