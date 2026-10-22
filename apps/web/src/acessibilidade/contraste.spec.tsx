// SPDX-License-Identifier: AGPL-3.0-or-later
import { colors as t } from "@rally/tokens";
import { describe, expect, it, vi } from "vitest";

import { CENARIOS } from "./cenario";

vi.mock("@/app/entrar/acoes", () => ({ entrar: vi.fn() }));
vi.mock("@/app/recuperar-senha/acoes", () => ({
  pedirLink: vi.fn(),
  redefinir: vi.fn(),
}));

/**
 * **Contraste das cores da web (RNF-08 · WCAG 2.2 AA).**
 *
 * O aplicativo mede contraste desde o PR #62, e a medição achou **quatro
 * pares reprovados** que a matriz dava como "resolvidos no design system". A
 * web ficou sem portão: o `lib/tokens.spec.tsx` garante que o Tailwind não
 * copie os hexes à mão, mas nada media o **par** — e token aprovado não quer
 * dizer combinação aprovada, porque uma cor só passa ou reprova contra o
 * fundo sobre o qual ela é de fato desenhada.
 *
 * Esta suíte mede os pares que a web **renderiza**, não a paleta inteira, e
 * as duas listas abaixo são escritas à mão: par novo na interface só entra
 * nelas se alguém lembrar de escrevê-lo.
 *
 * **Esse limite deixou de ser o fim da história.** O `tools/contraste.mjs`
 * mede, no navegador, a cor de **todo** elemento que pinta texto nas treze
 * telas, com o fundo que o `getComputedStyle` calcula — par novo entra na
 * medição por existir, e não por ser lembrado. Esta suíte continua porque
 * mede outra coisa: que a combinação **prevista pelo design system** fecha,
 * em jsdom, sem servidor nem banco, no mesmo segundo em que roda o resto da
 * suíte. Uma vê o mecanismo, a outra vê o resultado — o mesmo arranjo do
 * alvo de toque.
 */

type Par = { frente: string; fundo: string; uso: string };

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

/** Pares em que a cor da frente é **texto** — mínimo 4,5:1 (WCAG 1.4.3). */
const TEXTO: Par[] = [
  { frente: t.ink, fundo: t.white, uso: "corpo sobre card branco" },
  { frente: t.ink, fundo: t.bg, uso: "corpo sobre o fundo da página" },
  { frente: t.ink, fundo: t.sand, uso: "corpo sobre faixa de areia" },
  { frente: t.gray, fundo: t.white, uso: "texto de apoio sobre card" },
  { frente: t.gray, fundo: t.bg, uso: "texto de apoio sobre a página" },
  { frente: t.gray, fundo: t.sand, uso: "texto de apoio sobre areia" },
  { frente: t.coralDeep, fundo: t.white, uso: "link e erro sobre card" },
  { frente: t.coralDeep, fundo: t.bg, uso: "link e erro sobre a página" },
  { frente: t.coralDeep, fundo: t.sand, uso: "link e erro sobre areia" },
  { frente: t.white, fundo: t.ink, uso: "rótulo sobre botão escuro" },
  // O botão primário leva texto `ink`, e não branco: branco sobre coral dá
  // 2,82:1 e reprovaria. Foi a primeira coisa que esta suíte foi conferir.
  { frente: t.ink, fundo: t.coral, uso: "rótulo sobre o botão primário" },
  { frente: t.ink, fundo: t.sun, uso: "destaque sobre amarelo" },
];

/** Pares em que a frente é **ícone ou limite de componente** — mínimo 3:1. */
const COMPONENTE: Par[] = [
  { frente: t.ink, fundo: t.coral, uso: "ícone no botão primário" },
  { frente: t.white, fundo: t.ink, uso: "ícone no botão escuro" },
  { frente: t.coralDeep, fundo: t.white, uso: "ícone de ação secundária" },
];

describe("contraste — texto, mínimo 4,5:1 (WCAG 1.4.3, AA)", () => {
  it.each(TEXTO)("$uso", ({ frente, fundo, uso }) => {
    const razao = contraste(frente, fundo);
    expect(razao, `${uso}: ${frente} sobre ${fundo} = ${razao.toFixed(2)}:1`)
      .toBeGreaterThanOrEqual(4.5);
  });
});

describe("contraste — componentes e ícones, mínimo 3:1 (WCAG 1.4.11, AA)", () => {
  it.each(COMPONENTE)("$uso", ({ frente, fundo, uso }) => {
    const razao = contraste(frente, fundo);
    expect(razao, `${uso}: ${frente} sobre ${fundo} = ${razao.toFixed(2)}:1`)
      .toBeGreaterThanOrEqual(3);
  });
});

describe("a fórmula", () => {
  it("confere com os extremos conhecidos", () => {
    // Sem esta âncora, um erro no cálculo aprovaria a paleta inteira em
    // silêncio, e a suíte passaria a provar nada.
    expect(contraste("#000000", "#FFFFFF")).toBeCloseTo(21, 2);
    expect(contraste("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 2);
  });
});

describe("o coral puro não carrega informação", () => {
  it("só aparece como texto em elemento escondido do leitor", () => {
    // `coral` sobre branco dá 2,82:1 e sobre o fundo da página, 2,66:1 —
    // reprova nos dois. Ele continua na paleta porque é **ornamento**: as
    // aspas decorativas da seção de depoimento. A regra que o mantém honesto
    // é esta — se ele nunca diz nada, não precisa ser legível. Texto novo em
    // `text-coral` reprova aqui, e a correção é `text-coral-deep`.
    const expostos: string[] = [];

    for (const cenario of CENARIOS) {
      cenario.montar();
      for (const el of Array.from(document.querySelectorAll('[class*="text-coral"]'))) {
        const classes = el.className.split(/\s+/);
        if (!classes.includes("text-coral")) continue; // text-coral-deep passa
        if (el.closest('[aria-hidden="true"]')) continue;
        expostos.push(`${cenario.nome} → <${el.tagName.toLowerCase()}> "${el.textContent?.trim().slice(0, 30)}"`);
      }
      document.body.innerHTML = "";
    }

    expect(expostos, `coral puro visível ao leitor:\n  ${expostos.join("\n  ")}`)
      .toEqual([]);
  });
});
