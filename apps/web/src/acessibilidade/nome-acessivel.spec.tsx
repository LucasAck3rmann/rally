// SPDX-License-Identifier: AGPL-3.0-or-later
import { computeAccessibleName } from "dom-accessibility-api";
import { describe, expect, it, vi } from "vitest";

import { CENARIOS } from "./cenario";

vi.mock("@/app/entrar/acoes", () => ({ entrar: vi.fn() }));
vi.mock("@/app/recuperar-senha/acoes", () => ({
  pedirLink: vi.fn(),
  redefinir: vi.fn(),
}));

/**
 * **Nome acessível de todo controle da web (RNF-08).**
 *
 * Equivalente do `leitor_de_tela_test.dart`, que caminha a árvore de
 * semântica das 16 telas do aplicativo e exige nome em todo nó com ação de
 * toque. Aquele portão **não achou nada** — o app foi escrito com `Semantics`
 * desde o começo —, e o valor dele foi justamente transformar a afirmação
 * "tem leitor de tela" em medida. A web não tinha o equivalente.
 *
 * O nome é calculado pelo `dom-accessibility-api`, que é a implementação da
 * especificação *Accessible Name and Description Computation* usada pelo
 * próprio Testing Library nas consultas por papel. Então o que se verifica
 * aqui é o mesmo nome que o leitor de tela anunciaria: conteúdo de texto,
 * `aria-label`, `aria-labelledby` ou o `<label>` associado — nessa ordem de
 * precedência, e não o `placeholder`, que desaparece quando a pessoa começa a
 * digitar.
 */

const CONTROLES = [
  "button",
  "select",
  "textarea",
  'input:not([type="hidden"])',
  "a[href]",
  '[role="button"]',
].join(", ");

type Achado = { tela: string; controle: string };

function descrever(el: Element): string {
  const tipo = el.getAttribute("type");
  return `<${el.tagName.toLowerCase()}${tipo ? ` type="${tipo}"` : ""}>`;
}

function varrer(): { semNome: Achado[]; semRotulo: Achado[]; total: number } {
  const semNome: Achado[] = [];
  const semRotulo: Achado[] = [];
  let total = 0;

  for (const cenario of CENARIOS) {
    cenario.montar();

    for (const el of Array.from(document.querySelectorAll(CONTROLES))) {
      total++;
      if (!computeAccessibleName(el as HTMLElement).trim()) {
        semNome.push({ tela: cenario.nome, controle: descrever(el) });
      }
    }

    // Campo de entrada tem uma exigência a mais que ter nome: o nome precisa
    // vir de um `<label>` associado ou de `aria-label`, porque é o rótulo que
    // continua visível depois do preenchimento e é ele que amplia a área
    // clicável do campo.
    const campos = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea';
    for (const el of Array.from(document.querySelectorAll(campos))) {
      const temAria = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
      const id = el.getAttribute("id");
      const temLabel =
        (id && document.querySelector(`label[for="${id}"]`)) || el.closest("label");
      if (!temAria && !temLabel) {
        semRotulo.push({ tela: cenario.nome, controle: descrever(el) });
      }
    }

    document.body.innerHTML = "";
  }
  return { semNome, semRotulo, total };
}

function listar(achados: Achado[]): string {
  return achados.map((a) => `  ${a.tela} → ${a.controle}`).join("\n");
}

describe("nome acessível (RNF-08 · WCAG 4.1.2 e 2.4.6)", () => {
  const { semNome, semRotulo, total } = varrer();

  it("percorre controle de verdade, e não uma lista vazia", () => {
    // Sem a âncora, um seletor errado faz o portão passar varrendo nada.
    expect(total).toBeGreaterThan(20);
  });

  it("todo controle tem nome que o leitor anuncia", () => {
    expect(semNome, `controles sem nome acessível:\n${listar(semNome)}`).toEqual([]);
  });

  it("todo campo tem rótulo associado, e não só placeholder", () => {
    expect(semRotulo, `campos sem rótulo associado:\n${listar(semRotulo)}`).toEqual([]);
  });
});
