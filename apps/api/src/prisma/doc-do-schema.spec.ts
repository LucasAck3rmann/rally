// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **O `docs/modelo-de-dados.md` embute uma cópia do `schema.prisma`, e cópia
 * diverge.**
 *
 * Este é o quarto caso do mesmo tipo no projeto, e os três anteriores custaram
 * tempo: os tokens de cor estavam repetidos no `tailwind.config.ts` "em
 * sincronia por comentário" e divergiram, fazendo a web renderizar por dois
 * dias cores reprovadas em WCAG; a regra de permissão estava copiada em
 * quatro páginas antes do `podeAdministrar`; e a string do campo de
 * formulário, em três arquivos. Em todos, a correção foi a mesma: **uma
 * verdade, e um teste que impede a segunda de nascer.**
 *
 * Aqui a cópia não pode simplesmente sumir — ela existe para que a banca leia
 * o modelo sem abrir o código, e isso tem valor. Então fica a cópia **e** o
 * teste: quando o esquema muda, este teste reprova e diz para regenerar.
 *
 * Medido em 15/10, antes desta verificação existir: **53 linhas divergentes e
 * dois modelos ausentes** (`TokenDeSenha` e `TokenDeEmail`, de 13/10). O
 * documento dizia 19 entidades; o esquema tinha 21.
 */

const RAIZ = join(__dirname, "..", "..", "..", "..");
const SCHEMA = join(RAIZ, "apps", "api", "prisma", "schema.prisma");
const DOC = join(RAIZ, "docs", "modelo-de-dados.md");

function ler(caminho: string): string {
  // `\r\n` normalizado: o repositório é editado no Windows e no Linux, e uma
  // divergência de fim de linha não é divergência de modelo.
  return readFileSync(caminho, "utf8").replace(/\r\n/g, "\n").trim();
}

/** O bloco ```prisma do documento. */
function copiaNoDoc(): string {
  const doc = ler(DOC);
  const bloco = /```prisma\n([\s\S]*?)\n```/.exec(doc);
  if (!bloco) {
    throw new Error(
      "não achei o bloco ```prisma em docs/modelo-de-dados.md. " +
        "Se ele foi removido de propósito, remova este teste junto — " +
        "um teste que procura o que não existe mais vira ruído.",
    );
  }
  return bloco[1].trim();
}

describe("docs/modelo-de-dados.md espelha o schema.prisma", () => {
  it("a cópia no documento é idêntica ao esquema", () => {
    const real = ler(SCHEMA);
    const copia = copiaNoDoc();

    if (copia !== real) {
      const linhasReais = real.split("\n");
      const linhasCopia = copia.split("\n");
      const primeira = linhasReais.findIndex((l, i) => l !== linhasCopia[i]);
      throw new Error(
        "A cópia do esquema em `docs/modelo-de-dados.md` divergiu do " +
          "`apps/api/prisma/schema.prisma`.\n\n" +
          `Primeira diferença na linha ${primeira + 1}:\n` +
          `  schema: ${linhasReais[primeira] ?? "(fim do arquivo)"}\n` +
          `  doc:    ${linhasCopia[primeira] ?? "(fim do arquivo)"}\n\n` +
          "Para corrigir, substitua o conteúdo do bloco ```prisma do " +
          "documento pelo arquivo do esquema, inteiro.",
      );
    }
    expect(copia).toBe(real);
  });

  it("a contagem de entidades e enumerações confere com o esquema", () => {
    // O número aparece em prosa, e prosa não é verificada por diff — foi
    // justamente ele que ficou em "19 entidades" enquanto o esquema tinha 21.
    const real = ler(SCHEMA);
    const modelos = (real.match(/^model \w+ \{/gm) ?? []).length;
    const enums = (real.match(/^enum \w+ \{/gm) ?? []).length;
    const doc = ler(DOC);

    expect(doc).toContain(`**${modelos} entidades e ${enums} enumerações**`);
  });

  it("toda migração aplicada aparece na tabela do documento", () => {
    // A tabela listava três migrações quando havia oito. Uma migração fora da
    // tabela não quebra nada, e é exatamente por isso que ninguém percebe.
    const dir = join(RAIZ, "apps", "api", "prisma", "migrations");
    const migracoes = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    const doc = ler(DOC);

    const ausentes = migracoes.filter((m) => !doc.includes(m));
    expect(ausentes).toEqual([]);
  });
});
