// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colors as t } from "@rally/tokens";
import { describe, expect, it, vi } from "vitest";

import { CENARIOS } from "./cenario";

vi.mock("@/app/entrar/acoes", () => ({ entrar: vi.fn() }));
vi.mock("@/app/recuperar-senha/acoes", () => ({
  pedirLink: vi.fn(),
  redefinir: vi.fn(),
}));

/**
 * **Foco visível e ordem de foco na web (RNF-08 · WCAG 2.4.3, 2.4.7, 1.4.11).**
 *
 * Quarto portão da web, e o que fecha parte da lacuna que a Matriz declarava:
 * "falta ordem de foco". Ele nasceu de um defeito real, medido — não de uma
 * ideia de teste.
 *
 * **O defeito.** O `globals.css` define um contorno global bom:
 * `:focus-visible { outline: 2px solid coral-deep }` com 3 px de deslocamento.
 * Mas **oito declarações espalhadas pela interface usavam `outline-none`** e o
 * matavam, trocando-o por uma mudança de cor de borda (`focus:border-coral`).
 * Medido com a mesma fórmula do portão de contraste: o contorno global dá
 * **7,31:1** sobre branco, e a borda coral dá **2,82:1** — abaixo dos **3:1**
 * que a WCAG 1.4.11 exige de indicador de foco. Ou seja, sete controles
 * trocavam um indicador que passa por um que reprova, e nada acusava.
 *
 * **O que este portão verifica, e o que não verifica.** Verifica que ninguém
 * volta a remover o contorno, que o contorno declarado no CSS **de verdade**
 * tem contraste suficiente, e que a ordem de foco não é sabotada por
 * `tabindex` positivo nem por controle retirado da navegação por teclado.
 * **Não** verifica se a ordem de foco acompanha a ordem visual: isso depende
 * de posição na tela, o jsdom não tem motor de layout, e um teste que
 * fingisse medir isso passaria provando nada — mesmo limite, declarado, do
 * portão de alvo de toque.
 */

/** Controles que recebem foco. Link entra aqui: ele é parada de teclado. */
const FOCALIZAVEIS =
  'a[href], button, select, textarea, input:not([type="hidden"]), [tabindex], [role="button"]';

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canais.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Como o controle aparece na mensagem de falha. */
function identificar(el: Element): string {
  const nome = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
  return `${el.tagName.toLowerCase()}${nome ? ` "${nome.slice(0, 40)}"` : ""}`;
}

type Achado = { tela: string; controle: string; detalhe: string };

function varrer() {
  const semContorno: Achado[] = [];
  const tabindexPositivo: Achado[] = [];
  const foraDoTeclado: Achado[] = [];
  let total = 0;

  for (const cenario of CENARIOS) {
    cenario.montar();
    for (const el of Array.from(document.querySelectorAll(FOCALIZAVEIS))) {
      total++;
      const onde = { tela: cenario.nome, controle: identificar(el) };

      // `outline-none` do Tailwind não remove o contorno: põe um transparente.
      // O efeito para quem navega por teclado é o mesmo — ele some.
      if (/\boutline-none\b/.test(el.className)) {
        semContorno.push({ ...onde, detalhe: "outline-none" });
      }

      const tabindex = el.getAttribute("tabindex");
      if (tabindex !== null) {
        const n = Number(tabindex);
        if (n > 0) tabindexPositivo.push({ ...onde, detalhe: `tabindex=${n}` });
        // `-1` em elemento que é controle o tira da navegação por teclado.
        // Em `div`/`span` com foco programático é legítimo, e por isso o
        // corte é pelo tipo do elemento e não pelo valor sozinho.
        if (n < 0 && /^(a|button|select|textarea|input)$/i.test(el.tagName)) {
          foraDoTeclado.push({ ...onde, detalhe: `tabindex=${n}` });
        }
      }
    }
    document.body.innerHTML = "";
  }
  return { semContorno, tabindexPositivo, foraDoTeclado, total };
}

function listar(achados: Achado[]): string {
  return achados.map((a) => `  ${a.tela} → ${a.controle} (${a.detalhe})`).join("\n");
}

/**
 * Lê a regra de foco do `globals.css` **de verdade**.
 *
 * É a âncora que cobre a alimentação do portão: se o teste trouxesse a cor
 * numa constante própria, alguém poderia trocar o CSS para um contorno fraco
 * e a suíte continuaria medindo o valor antigo — foi a lição do #95, em que
 * o portão existia e a lista que o alimentava estava desatualizada.
 */
function contornoDeclarado(): { cor: string; largura: number } {
  const css = readFileSync(
    join(process.cwd(), "src/app/globals.css"),
    "utf-8",
  );
  const regra = /:focus-visible\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
  const linha = /outline:\s*(\d+)px\s+solid\s+theme\(colors\.([\w-]+)\)/.exec(regra);
  if (!linha) throw new Error(`regra :focus-visible não reconhecida em:\n${regra}`);

  // `coral-deep` no CSS é `coralDeep` no pacote de tokens.
  const nome = linha[2].replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  const cor = (t as unknown as Record<string, string>)[nome];
  if (!cor) throw new Error(`token "${nome}" não existe em @rally/tokens`);
  return { cor, largura: Number(linha[1]) };
}

describe("foco visível e ordem de foco (RNF-08)", () => {
  const { semContorno, tabindexPositivo, foraDoTeclado, total } = varrer();

  it("percorre controle de verdade, e não uma lista vazia", () => {
    // Sem esta âncora, um seletor errado faria o portão passar varrendo nada.
    expect(total).toBeGreaterThan(30);
  });

  it("nenhum controle remove o contorno de foco", () => {
    // **O defeito que originou este arquivo.** Oito declarações usavam
    // `outline-none` e trocavam um indicador de 7,31:1 por um de 2,82:1.
    // Quem precisar de um visual próprio soma ao contorno, não o substitui.
    expect(
      semContorno,
      `controles sem contorno de foco:\n${listar(semContorno)}`,
    ).toEqual([]);
  });

  it("o contorno declarado no CSS tem contraste suficiente (1.4.11)", () => {
    // Medido contra os dois fundos sobre os quais a interface desenha
    // controle: o card branco e o fundo da página.
    const { cor, largura } = contornoDeclarado();
    const sobreBranco = contraste(cor, t.white);
    const sobreFundo = contraste(cor, t.bg);

    expect(largura).toBeGreaterThanOrEqual(2);
    expect(
      Number(sobreBranco.toFixed(2)),
      `contorno ${cor} sobre branco = ${sobreBranco.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      Number(sobreFundo.toFixed(2)),
      `contorno ${cor} sobre o fundo = ${sobreFundo.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("a borda coral sozinha **não** serviria como indicador, e é por isso que o contorno fica", () => {
    // Registra a medida que motivou a correção, para que a tentação de
    // voltar ao `outline-none focus:border-coral` encontre o número pronto.
    expect(contraste(t.coral, t.white)).toBeLessThan(3);
  });

  it("nenhum `tabindex` positivo quebra a ordem de foco (2.4.3)", () => {
    // `tabindex` positivo joga o elemento à frente de tudo que está em ordem
    // de documento, e é o jeito clássico de a ordem de foco deixar de
    // acompanhar a ordem de leitura.
    expect(
      tabindexPositivo,
      `controles com tabindex positivo:\n${listar(tabindexPositivo)}`,
    ).toEqual([]);
  });

  it("nenhum controle fica fora da navegação por teclado (2.1.1)", () => {
    expect(
      foraDoTeclado,
      `controles retirados do teclado:\n${listar(foraDoTeclado)}`,
    ).toEqual([]);
  });
});
