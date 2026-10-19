// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Nenhum Server Component passa função para um Client Component.**
 *
 * Em 19/10/2026 seis telas do painel — agenda, mensalistas, cupons, quadras,
 * equipe e conciliação — **quebravam em tempo de execução**, inteiras, antes
 * de renderizar o título. Todas passavam `acao={(…) => algumaAcao(…)}` para o
 * `BotaoDeAcao`, que é Client Component. Num Server Component essa seta é uma
 * função comum criada no servidor, e o Next recusa serializá-la:
 * *"Functions cannot be passed directly to Client Components"*.
 *
 * **As 318 verificações da web passavam.** Elas montam o componente direto no
 * jsdom, onde não existe fronteira entre servidor e cliente: a árvore inteira
 * é só React. O defeito só aparece no runtime do Next — e só foi visto quando
 * a captura de tela passou a cobrar o título da página e encontrou outra
 * coisa no lugar.
 *
 * Este teste é o portão que faltava, e ele olha o **elemento**, não o
 * arquivo: Server Component pode importar e renderizar Client Component à
 * vontade, isso é o padrão normal. O que não pode é passar função.
 */

const AQUI = __dirname;

/** Os componentes desta pasta que declaram `"use client"`. */
function clientes(): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(AQUI)) {
    if (!nome.endsWith(".tsx") || nome.endsWith(".spec.tsx")) continue;
    const texto = readFileSync(join(AQUI, nome), "utf8");
    if (!/^\s*"use client";/m.test(texto)) continue;
    // O nome do componente exportado é o que aparece no JSX de quem o usa.
    for (const [, exportado] of texto.matchAll(/export function (\w+)/g)) {
      achados.push(exportado);
    }
  }
  return achados;
}

/**
 * A região de atributos de cada `<Componente ...>` do texto.
 *
 * Conta chaves em vez de parar no primeiro `>`: um atributo como
 * `acao={() => f(a > b)}` tem `>` dentro, e parar nele leria meio elemento e
 * acusaria defeito onde não há.
 */
function atributosDe(texto: string, componente: string): string[] {
  const regioes: string[] = [];
  const abertura = new RegExp(`<${componente}[\\s/>]`, "g");
  for (const achado of texto.matchAll(abertura)) {
    let i = achado.index + achado[0].length - 1;
    let chaves = 0;
    for (; i < texto.length; i++) {
      const c = texto[i];
      if (c === "{") chaves++;
      else if (c === "}") chaves--;
      else if (c === ">" && chaves === 0) break;
    }
    regioes.push(texto.slice(achado.index, i));
  }
  return regioes;
}

/** `prop={(x) => …}`, `prop={function …}` e `prop={async (…) => …}`. */
const FUNCAO_INLINE = /(\w+)=\{\s*(async\s*)?(\([^)]*\)|\w+)\s*=>|(\w+)=\{\s*function\b/;

describe("fronteira entre servidor e cliente", () => {
  const COMPONENTES_CLIENTE = clientes();

  it("a varredura acha os componentes de cliente de verdade", () => {
    // Sem esta âncora, um erro na leitura faria o teste varrer nada e passar
    // provando o contrário do que promete.
    expect(COMPONENTES_CLIENTE.length).toBeGreaterThan(2);
    expect(COMPONENTES_CLIENTE).toContain("BotaoDeAcao");
  });

  it("nenhum Server Component passa função a um Client Component", () => {
    const faltas: string[] = [];

    for (const nome of readdirSync(AQUI)) {
      if (!nome.endsWith(".tsx") || nome.endsWith(".spec.tsx")) continue;
      const texto = readFileSync(join(AQUI, nome), "utf8");
      // Em Client Component a seta nasce no cliente e não atravessa nada.
      if (/^\s*"use client";/m.test(texto)) continue;

      for (const componente of COMPONENTES_CLIENTE) {
        for (const atributos of atributosDe(texto, componente)) {
          const achado = FUNCAO_INLINE.exec(atributos);
          if (!achado) continue;
          const prop = achado[1] ?? achado[4];
          // O valor afirmado leva arquivo, componente e prop: a falha diz
          // onde está, sem exigir busca depois.
          faltas.push(`${nome}: <${componente} ${prop}={…}> — falta "use client"`);
        }
      }
    }

    expect(faltas).toEqual([]);
  });
});
