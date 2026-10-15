// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Papel } from "./contratos";

/**
 * O que a interface esconde porque o servidor recusaria.
 *
 * **Quem decide é o `PapelGuard`.** Isto não autoriza nada — evita entregar
 * um 403 no lugar de uma tela honesta. A regra fica num arquivo só porque
 * ela estava repetida em quatro páginas como `papel === "ADMIN" || papel ===
 * "MANTENEDOR"`, e as quatro estavam erradas do mesmo jeito: o
 * `PAPEIS_DE_GESTAO` da API não inclui `MANTENEDOR`, que é papel da
 * plataforma (nível SaaS), e o guard o recusa em toda rota de arena.
 *
 * Quatro cópias de uma regra são quatro chances de ela divergir da API. Uma
 * só, com teste, é o que impede a quinta página de reinventá-la.
 */

/** Escrever na arena: criar quadra, bloquear horário, mexer na equipe. */
export function podeAdministrar(papel: Papel | null): boolean {
  return papel === "ADMIN";
}
