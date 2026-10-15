// SPDX-License-Identifier: AGPL-3.0-or-later
import { colors as tokens } from "@rally/tokens";
import { describe, expect, it } from "vitest";

import config from "../../tailwind.config";

/**
 * **As cores da web vêm do pacote de tokens, não de cópia.**
 *
 * Este arquivo existe por um defeito real: até 30/09 o `tailwind.config.ts`
 * repetia os hexes à mão, com um comentário dizendo "mantidos em sincronia".
 * Não estavam. O PR #62 escureceu `coralDeep` e `gray` por contraste
 * (RNF-08) e a web continuou renderizando os valores reprovados — ninguém
 * edita dois arquivos para mudar uma cor.
 *
 * O teste não existe para achar bug de código; existe para que a próxima
 * cópia à mão não passe despercebida.
 */
describe("tokens do design system", () => {
  const cores = config.theme?.extend?.colors as Record<string, string>;

  it.each([
    ["coral", tokens.coral],
    ["coral-deep", tokens.coralDeep],
    ["teal", tokens.teal],
    ["sun", tokens.sun],
    ["sand", tokens.sand],
    ["bg", tokens.bg],
    ["ink", tokens.ink],
    ["gray", tokens.gray],
    ["line", tokens.line],
  ])("%s vem do pacote", (nome, esperado) => {
    expect(cores[nome]).toBe(esperado);
  });
});
