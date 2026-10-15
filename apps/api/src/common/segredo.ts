// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compara dois segredos em **tempo constante**.
 *
 * `===` sai na primeira letra diferente, e a diferença de tempo entre
 * "errou no primeiro caractere" e "errou no último" permite descobrir o
 * segredo caractere a caractere. O hash iguala o comprimento primeiro —
 * `timingSafeEqual` exige buffers do mesmo tamanho, e o tamanho do segredo
 * também é informação.
 *
 * **Mora aqui, e não dentro de um guarda, porque o segundo consumidor
 * apareceu.** Ela nasceu no `SegredoDeIngestaoGuard` em setembro; quando o
 * webhook de pagamento precisou da mesma comparação, copiá-la seria a quinta
 * cópia de uma verdade neste projeto — e as quatro anteriores (tokens de cor,
 * regra de permissão, texto de campo, cópia do esquema) divergiram todas
 * antes de alguém notar. Numa função de segurança, divergir significa que
 * **uma das cópias deixa de ser de tempo constante** e ninguém percebe,
 * porque as duas continuam devolvendo a resposta certa.
 */
export function segredosIguais(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
