// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Toda tela do painel aparece na lista de cenários.**
 *
 * Os três portões de acessibilidade — contraste, alvo de toque e nome
 * acessível — percorrem o que estiver em `CENARIOS`. A lista é escrita à
 * mão, e por isso o que não entra nela **não é verificado por nenhum dos
 * três**, em silêncio.
 *
 * Isso já aconteceu duas vezes. Na primeira, o botão "Sair" da barra lateral
 * passou com 33 px porque a barra não estava na lista, e a lição foi nomeada
 * então: *portão alimentado à mão precisa de uma âncora que cubra a
 * alimentação*. A âncora que entrou foi `total > 20` — um **limite de
 * tamanho**, que passa enquanto a lista cobrir controles suficientes, venham
 * de onde vierem.
 *
 * Na segunda, em 19/10/2026, **quatro telas do painel não estavam na lista**:
 * painel, agenda, mensalistas e conciliação. O `total > 20` passava folgado
 * com as outras. Quem achou foi a medida no navegador de verdade, que
 * encontrou na agenda um botão de **40,8 × 16,5 px** — e a agenda nunca
 * tinha sido montada por portão nenhum.
 *
 * Esta é a âncora por **correspondência**, e não por tamanho: a lista de
 * telas é derivada das páginas, e cada componente que uma página de gestão
 * renderiza tem de aparecer no arquivo de cenários. É a mesma forma que o
 * portão de auditoria da API usa ao ler os controladores do módulo em vez de
 * confiar numa lista digitada.
 */

const AQUI = __dirname;
const APP = join(AQUI, "..", "app", "gestao");
const CENARIOS = join(AQUI, "cenario.tsx");

/** Todo `page.tsx` sob `app/gestao`, em qualquer profundidade. */
function paginas(pasta: string): string[] {
  const achadas: string[] = [];
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) achadas.push(...paginas(caminho));
    else if (item.name === "page.tsx") achadas.push(caminho);
  }
  return achadas;
}

/** Os componentes de `components/gestao` que cada página renderiza. */
function telasDoPainel(): { componente: string; pagina: string }[] {
  const achados: { componente: string; pagina: string }[] = [];
  for (const pagina of paginas(APP)) {
    const texto = readFileSync(pagina, "utf8");
    for (const [, componente] of texto.matchAll(
      /import \{ (\w+) \} from "@\/components\/gestao\//g,
    )) {
      achados.push({
        componente,
        pagina: pagina.slice(pagina.indexOf("app")).split("\\").join("/"),
      });
    }
  }
  return achados;
}

describe("os cenários cobrem as telas do painel", () => {
  const telas = telasDoPainel();

  it("a varredura acha páginas de verdade", () => {
    // Sem esta âncora, um caminho errado faria o teste varrer pasta vazia e
    // passar — provando o contrário do que promete, que é o defeito que ele
    // próprio existe para corrigir.
    expect(telas.length).toBeGreaterThan(5);
    expect(telas.map((t) => t.componente)).toContain("AgendaDaArena");
  });

  it("todo componente que uma página renderiza está nos cenários", () => {
    const cenarios = readFileSync(CENARIOS, "utf8");
    // O valor afirmado leva componente e página: a falha diz qual tela ficou
    // de fora e onde ela é usada, sem exigir busca depois.
    const fora = telas
      .filter(({ componente }) => !cenarios.includes(componente))
      .map(({ componente, pagina }) => `${componente} (${pagina})`);

    expect(fora).toEqual([]);
  });
});
