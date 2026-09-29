// SPDX-License-Identifier: AGPL-3.0-or-later

/** Junta classes ignorando o que for falso — evita puxar clsx só para isto. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
