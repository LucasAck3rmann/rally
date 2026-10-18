// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * **Todo link relativo entre documentos aponta para arquivo que existe.**
 *
 * Link morto em documentação não quebra nada, e é por isso que sobrevive:
 * ninguém executa um documento. No GitHub ele dá 404 para quem clica — e quem
 * clica, aqui, é a banca.
 *
 * Três estavam de pé quando este teste foi escrito, todos do mesmo tipo:
 * **nome de arquivo do vault sobrevivendo numa cópia para o repositório**.
 * `Requisitos.md` com maiúscula e no diretório errado, `Arquitetura%20e%20
 * Stack.md` com o espaço codificado, e um `Modelo%20de%20Dados%20(schema.
 * prisma).md`. Os documentos nasceram no Obsidian, onde o nome é esse e o
 * link resolve por título; ao virarem `docs/*.md` em minúsculas, os alvos
 * ficaram apontando para nomes que só existiam do outro lado.
 *
 * O teste mora em `apps/api` porque é lá que roda o Jest deste monorepo, pelo
 * mesmo arranjo do `doc-do-schema.spec.ts`. Não é código da API: é um portão
 * do repositório hospedado pelo executor que existe.
 */

const RAIZ = resolve(join(__dirname, "..", "..", "..", ".."));
const DOCS = join(RAIZ, "docs");

/** Caminho relativo à raiz, sempre com `/`: a saída é a mesma no Windows e na CI. */
function daRaiz(caminho: string): string {
  return caminho.slice(RAIZ.length + 1).split("\\").join("/");
}

/** Todo `.md` de `docs/` (recursivo) e os da raiz do repositório. */
function documentos(): string[] {
  const achados: string[] = [];

  const descer = (pasta: string) => {
    for (const item of readdirSync(pasta, { withFileTypes: true })) {
      const caminho = join(pasta, item.name);
      if (item.isDirectory()) descer(caminho);
      else if (item.name.endsWith(".md")) achados.push(caminho);
    }
  };
  descer(DOCS);

  for (const item of readdirSync(RAIZ, { withFileTypes: true })) {
    if (item.isFile() && item.name.endsWith(".md")) {
      achados.push(join(RAIZ, item.name));
    }
  }
  return achados.sort();
}

/**
 * Os alvos dos links `[texto](alvo)` de um documento.
 *
 * O destino é lido contando parênteses, e não com `[^)]*`: o alvo pode
 * conter parênteses balanceados — `(schema.prisma).md` era justamente um dos
 * links quebrados —, e um padrão que para no primeiro `)` leria meio alvo e
 * acusaria um defeito diferente do que existe.
 */
function alvos(texto: string): { alvo: string; linha: number }[] {
  const achados: { alvo: string; linha: number }[] = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== "]" || texto[i + 1] !== "(") continue;
    let profundidade = 1;
    let j = i + 2;
    for (; j < texto.length && profundidade > 0; j++) {
      if (texto[j] === "(") profundidade++;
      else if (texto[j] === ")") profundidade--;
      else if (texto[j] === "\n") break;
    }
    if (profundidade !== 0) continue;
    achados.push({
      alvo: texto.slice(i + 2, j - 1).trim(),
      linha: texto.slice(0, i).split("\n").length,
    });
    i = j - 1;
  }
  return achados;
}

/** Caminho de arquivo a conferir, ou `null` quando o link não é um. */
function paraCaminho(alvo: string): string | null {
  if (/^(https?:|mailto:|tel:|#)/.test(alvo)) return null;
  // `<...>` é a forma de link com espaços; a âncora não faz parte do arquivo.
  const semEnfeite = alvo.replace(/^<|>$/g, "").split("#")[0].trim();
  if (!semEnfeite) return null;
  // O GitHub decodifica a porcentagem para achar o arquivo, e por isso o
  // teste também: um `%20` que decodifica para nome existente é link **vivo**,
  // e reprová-lo seria inventar defeito.
  try {
    return decodeURIComponent(semEnfeite);
  } catch {
    return semEnfeite;
  }
}

describe("links dos documentos", () => {
  const todos = documentos();

  it("a varredura acha documentos de verdade", () => {
    // Sem esta âncora, um erro no caminho da raiz faria o teste passar
    // varrendo pasta vazia — e passaria a provar o contrário do que promete.
    expect(todos.length).toBeGreaterThan(10);
    expect(todos.some((d) => d.endsWith("requisitos.md"))).toBe(true);
  });

  it("nenhum link relativo aponta para arquivo inexistente", () => {
    const mortos: string[] = [];
    let conferidos = 0;

    for (const doc of todos) {
      const texto = readFileSync(doc, "utf8");
      for (const { alvo, linha } of alvos(texto)) {
        const relativo = paraCaminho(alvo);
        if (relativo === null) continue;
        conferidos++;
        if (existsSync(resolve(dirname(doc), relativo))) continue;
        // O valor afirmado carrega arquivo, linha e alvo: a saída do Jest
        // diz **qual** link está morto, sem precisar de busca depois.
        mortos.push(`${daRaiz(doc)}:${linha} -> ${alvo}`);
      }
    }

    expect(mortos).toEqual([]);
    // Segunda âncora: zero links conferidos significaria que o leitor parou de
    // casar, e aí a lista vazia acima não prova nada.
    expect(conferidos).toBeGreaterThan(50);
  });

  it("não sobrou sintaxe de link do Obsidian nos documentos", () => {
    // `[[Documento]]` resolve no vault e renderiza **literalmente** no
    // GitHub, com os colchetes à vista. É a mesma origem dos três links
    // mortos: documento que nasceu no Obsidian e foi copiado para cá.
    const comWikilink = todos
      .filter((doc) => /\[\[[^\]]+\]\]/.test(readFileSync(doc, "utf8")))
      .map(daRaiz);

    expect(comWikilink).toEqual([]);
  });
});
