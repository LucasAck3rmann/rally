// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash, randomBytes } from "node:crypto";

/**
 * Mecânica compartilhada pelos tokens de conta (RF-03).
 *
 * A recuperação de senha e a verificação de e-mail guardam tokens em tabelas
 * diferentes, de propósito — validades e consequências diferentes —, mas a
 * **forma** de produzir e conferir o segredo é a mesma. Duas cópias dela
 * seriam duas chances de uma divergir: bastaria uma passar a guardar o token
 * em claro para a separação de tabelas não valer nada.
 */

/**
 * Hash do token para guardar e para buscar.
 *
 * `sha256` e não argon2 porque aqui o segredo tem **entropia completa** — ele
 * é sorteado, não escolhido por uma pessoa. Argon2 existe para encarecer a
 * força bruta contra segredo fraco; contra 32 bytes aleatórios não há força
 * bruta a encarecer, e o custo só atrasaria a resposta.
 */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Segredo novo.
 *
 * 32 bytes em base64url: entropia suficiente para o hash rápido bastar, e sem
 * caractere que o cliente de e-mail quebre ao montar o link.
 */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}
