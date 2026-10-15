// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";

import { CENARIOS } from "./cenario";

// As Server Actions não rodam no jsdom; os formulários só precisam renderizar.
vi.mock("@/app/entrar/acoes", () => ({ entrar: vi.fn() }));
vi.mock("@/app/recuperar-senha/acoes", () => ({
  pedirLink: vi.fn(),
  redefinir: vi.fn(),
}));

/**
 * **Alvo de toque mínimo na web (RNF-08).**
 *
 * O aplicativo **mede** o alvo de toque desde o PR #57: renderiza a tela e lê
 * o tamanho do widget. A web não tinha portão nenhum, e o relatório afirmava
 * "alvos de toque de ao menos 44 pixels" nas duas superfícies — afirmação sem
 * medida, que é o padrão que este arquivo existe para quebrar.
 *
 * **O limite honesto deste portão:** o jsdom não tem motor de layout. Toda
 * altura computada volta como `0px`, então medir aqui é impossível — e um
 * teste que lesse `getBoundingClientRect` passaria sempre, provando nada.
 * O que ele verifica é a **classe declarada**: o controle precisa dizer a
 * própria altura, e essa altura precisa ser ≥ 44 px. É verificação do
 * mecanismo, não do pixel; a medida real depende de navegador, e fica para o
 * ensaio de usabilidade de novembro.
 *
 * **Por que 44 e não 24.** O critério 2.5.8 da WCAG 2.2, no nível AA, pede
 * 24 × 24. Os 44 vêm do próprio projeto: o RNF-08 e a seção 5.2 do relatório
 * declaram 44 px, que é o 2.5.5 (nível AAA) e a recomendação das duas
 * plataformas móveis. Medir contra o número que o documento promete é o que
 * mantém documento e produto na mesma história.
 */

/** Controles que são alvo de toque primário. Link dentro de frase não é. */
const CONTROLES = 'button, select, input:not([type="hidden"]), [role="button"]';

/**
 * Altura declarada por classe do Tailwind, em pixels.
 *
 * `h-11` vale 44 px porque a unidade do Tailwind é 0,25 rem e a raiz do
 * documento é 16 px. `h-[44px]` é literal. Quando as duas aparecem, vale a
 * fixa: é ela que define a altura final.
 */
function alturaDeclarada(classe: string): number | null {
  const classes = classe.split(/\s+/);
  const literal = (prefixo: string) => {
    const achada = classes.find((c) => new RegExp(`^${prefixo}-\\[\\d+px\\]$`).test(c));
    return achada ? Number(achada.replace(/\D/g, "")) : null;
  };
  const escala = (prefixo: string) => {
    const achada = classes.find((c) => new RegExp(`^${prefixo}-\\d+(\\.5)?$`).test(c));
    return achada ? Number(achada.slice(prefixo.length + 1)) * 4 : null;
  };

  // Ordem de precedência: altura fixa, depois mínima, depois `size`.
  return (
    literal("h") ??
    escala("h") ??
    literal("min-h") ??
    escala("min-h") ??
    escala("size") ??
    null
  );
}

/** Como o controle aparece na mensagem de falha. */
function identificar(el: Element): string {
  const nome = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
  const tipo = el.getAttribute("type");
  return [
    el.tagName.toLowerCase(),
    tipo ? `[${tipo}]` : "",
    nome ? ` "${nome.slice(0, 40)}"` : "",
  ].join("");
}

type Achado = { tela: string; controle: string; altura: number | null };

function varrer(): { baixos: Achado[]; semAltura: Achado[]; total: number } {
  const baixos: Achado[] = [];
  const semAltura: Achado[] = [];
  let total = 0;

  for (const cenario of CENARIOS) {
    cenario.montar();
    for (const el of Array.from(document.querySelectorAll(CONTROLES))) {
      total++;
      const altura = alturaDeclarada(el.className);
      const achado = { tela: cenario.nome, controle: identificar(el), altura };
      if (altura === null) semAltura.push(achado);
      else if (altura < 44) baixos.push(achado);
    }
    document.body.innerHTML = "";
  }
  return { baixos, semAltura, total };
}

function listar(achados: Achado[]): string {
  return achados
    .map((a) => `  ${a.tela} → ${a.controle}${a.altura === null ? "" : ` = ${a.altura}px`}`)
    .join("\n");
}

describe("alvo de toque ≥ 44 px (RNF-08 · o número que o projeto promete)", () => {
  const { baixos, semAltura, total } = varrer();

  it("percorre controle de verdade, e não uma lista vazia", () => {
    // Sem esta âncora, um seletor errado faria o portão passar varrendo nada
    // — e passaria a provar o contrário do que promete.
    expect(total).toBeGreaterThan(20);
  });

  it("nenhum controle declara altura abaixo de 44 px", () => {
    expect(baixos, `controles abaixo de 44 px:\n${listar(baixos)}`).toEqual([]);
  });

  it("todo controle declara a própria altura", () => {
    // Altura que vem de preenchimento mais conteúdo depende da fonte
    // carregada, e aí o alvo deixa de ser decisão e passa a ser acidente.
    expect(semAltura, `controles sem altura declarada:\n${listar(semAltura)}`).toEqual([]);
  });
});
