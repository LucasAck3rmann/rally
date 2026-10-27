// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Prova a exceção do Dependabot no `commitlint.config.js` — que ela abre o
 * que precisa abrir, e **só** isso.
 *
 *   node tools/confere-commitlint.mjs
 *
 * **Por que um portão sobre o portão.** O `ignores` do commitlint é uma função
 * que recebe a mensagem e devolve "dispensa esta". Escrever uma frouxa é
 * fácil e não dá erro nenhum: `/^chore\(deps/` dispensaria qualquer commit
 * que começasse assim, e a convenção inteira viraria opcional para quem
 * descobrisse o atalho. Escrever uma estreita demais também não dá erro —
 * ela simplesmente não casa, e os dezesseis PRs seguem vermelhos. Nos dois
 * casos o arquivo continua válido, o CI continua verde, e ninguém fica
 * sabendo.
 *
 * Daí a medida nos dois sentidos: as mensagens **reais** dos dezesseis PRs de
 * 26/10 têm de passar, e as mutações delas têm de continuar sendo recusadas.
 * É a mesma regra que o resto do repositório usa para portão — ele vale o que
 * vale a mutação que ele pega.
 *
 * **Roda o commitlint de verdade**, o mesmo binário e a mesma configuração do
 * trabalho `Mensagens de commit`, e não uma imitação da regra. Se a exceção
 * for reescrita, ou se o `config-conventional` mudar de ideia sobre
 * `subject-case` numa versão nova, esta ferramenta descobre.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

const ASSINATURA = "Signed-off-by: dependabot[bot] <support@github.com>";

/**
 * Uma linha de corpo como as que o Dependabot escreve: link de markdown para
 * o repositório da dependência, **passada de 100 caracteres**. É o segundo
 * motivo pelo qual os PRs dele caíam, e o corpo precisa dela para que o teste
 * esteja medindo os dois motivos e não só o do assunto.
 */
const LINHA_COMPRIDA =
  "Bumps [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier) from 9.1.2 to 10.1.8.";

/** O corpo e o rodapé que acompanham um commit do Dependabot. */
function corpoDele({ assinatura = ASSINATURA } = {}) {
  return [
    "",
    LINHA_COMPRIDA,
    "- [Release notes](https://github.com/prettier/eslint-config-prettier/releases)",
    "- [Commits](https://github.com/prettier/eslint-config-prettier/commits/v10.1.8)",
    "",
    "---",
    "updated-dependencies:",
    "- dependency-name: eslint-config-prettier",
    "  update-type: version-update:semver-major",
    "...",
    "",
    assinatura,
  ].join("\n");
}

/**
 * Os quinze cabeçalhos distintos dos dezesseis PRs abertos em 26/10, copiados
 * do `gh pr view`. Quatro formas aparecem aqui, e todas as quatro vêm do
 * mesmo `dependabot.yml`:
 *
 *   - `Bump x from a to b` — o caso comum;
 *   - `... in /apps/mobile` — quando o ecossistema não é o da raiz;
 *   - `Bump x and y` / `Bump x` — quando ele **encurta** porque o cabeçalho
 *     passaria do limite com as versões;
 *   - `Bump the <grupo> group with N updates` — quando o grupo do
 *     `dependabot.yml` junta vários num PR.
 *
 * A terceira só apareceu porque a lista foi copiada da realidade em vez de
 * imaginada; uma expressão escrita de cabeça teria exigido o `from ... to ...`
 * e deixado dois PRs de fora.
 */
const DELE_DE_VERDADE = [
  "chore(deps): Bump @nestjs/config from 4.0.4 to 12.0.1",
  "chore(deps): Bump @nestjs/platform-express from 11.2.6 to 12.2.0",
  "chore(deps): Bump @nestjs/schedule from 6.1.3 to 12.0.2",
  "chore(deps): Bump flutter_riverpod from 2.6.1 to 3.4.3 in /apps/mobile",
  "chore(deps): Bump flutter_secure_storage in /apps/mobile",
  "chore(deps): Bump framer-motion from 13.4.6 to 14.6.0",
  "chore(deps): Bump go_router from 14.8.1 to 18.1.1 in /apps/mobile",
  "chore(deps): Bump google_fonts from 6.3.3 to 9.0.0 in /apps/mobile",
  "chore(deps): Bump share_plus from 10.1.4 to 12.0.2 in /apps/mobile",
  "chore(deps): Bump the npm-minor-patch group with 3 updates",
  "chore(deps-dev): Bump @types/node from 22.20.4 to 26.6.5",
  "chore(deps-dev): Bump eslint-config-prettier from 9.1.2 to 10.1.8",
  "chore(deps-dev): Bump jest and @types/jest",
  "chore(deps-dev): Bump tailwindcss from 3.4.19 to 4.3.3",
  "chore(deps-dev): Bump typescript from 5.9.3 to 6.0.3",
];

const casos = [
  ...DELE_DE_VERDADE.map((cabecalho) => ({
    nome: cabecalho.slice(0, 58),
    mensagem: cabecalho + "\n" + corpoDele(),
    espera: "passa",
    porque: "PR real de 26/10",
  })),

  // ─── As mutações. Cada uma tira **uma** coisa da mensagem que passa. ───

  {
    nome: "o mesmo cabeçalho, sem a assinatura dele",
    mensagem:
      "chore(deps): Bump alguma-coisa from 1.0.0 to 2.0.0\n" + corpoDele({ assinatura: "" }),
    espera: "recusa",
    porque:
      "sem isto, qualquer pessoa escrevendo `chore(deps): Bump ...` à mão " +
      "escaparia da convenção inteira",
  },
  {
    nome: "a assinatura dele num commit de gente",
    mensagem: "feat(web): Tela Nova Em Maiúsculas\n" + corpoDele(),
    espera: "recusa",
    porque: "sem isto a assinatura seria chave-mestra: bastaria colá-la no rodapé",
  },
  {
    nome: "a assinatura com outro endereço",
    mensagem:
      "chore(deps): Bump alguma-coisa from 1.0.0 to 2.0.0\n" +
      corpoDele({ assinatura: "Signed-off-by: dependabot[bot] <lucas@exemplo.com>" }),
    espera: "recusa",
    porque: "o nome entre colchetes é digitável; o endereço do bot é a parte que identifica",
  },
  {
    nome: "escopo parecido, mas não o do dependabot.yml",
    mensagem: "chore(dependencies): Bump alguma-coisa from 1.0.0 to 2.0.0\n" + corpoDele(),
    espera: "recusa",
    porque: "a exceção é da forma que o `dependabot.yml` gera, não de qualquer escopo de deps",
  },

  // ─── As duas âncoras: provam que esta ferramenta sabe falhar e sabe passar.
  // Sem elas, um erro no jeito de rodar o commitlint — binário errado,
  // configuração não encontrada, código de saída lido de outro lugar — daria
  // "tudo como esperado" em cima de nada.

  {
    nome: "âncora · mensagem ruim de gente é recusada",
    mensagem: "Arruma umas Coisas",
    espera: "recusa",
    porque: "se até isto passasse, o commitlint não estaria sendo chamado",
  },
  {
    nome: "âncora · mensagem boa de gente passa",
    mensagem:
      "fix(api): o bloqueio de agenda respeita o fuso do estabelecimento\n\n" +
      "Signed-off-by: Lucas Ackermann <ackermannlucas25@gmail.com>",
    espera: "passa",
    porque: "se até isto fosse recusado, a configuração estaria quebrada e não estreita",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

let CLI;
try {
  CLI = join(dirname(createRequire(import.meta.url).resolve("@commitlint/cli")), "cli.js");
} catch {
  console.error(
    "Não achei o `@commitlint/cli`. Rode `pnpm install --frozen-lockfile` na raiz antes.",
  );
  process.exit(2);
}

/** Roda o commitlint de verdade com a mensagem na entrada padrão. */
function rodar(mensagem) {
  return new Promise((resolve) => {
    const processo = spawn(process.execPath, [CLI], { cwd: RAIZ });
    let saida = "";
    processo.stdout.on("data", (pedaco) => (saida += pedaco));
    processo.stderr.on("data", (pedaco) => (saida += pedaco));
    processo.on("error", (causa) => resolve({ passou: false, saida: String(causa) }));
    processo.on("close", (codigo) => resolve({ passou: codigo === 0, saida }));
    processo.stdin.end(mensagem);
  });
}

async function main() {
  console.log("Confere a exceção do Dependabot no commitlint.config.js\n");

  let falhas = 0;

  // A âncora do próprio material: se a linha comprida encurtar numa edição
  // futura, o corpo deixa de exercitar o `body-max-line-length` e metade do
  // motivo pelo qual os PRs caíam sai de medição, em silêncio.
  if (LINHA_COMPRIDA.length <= 100) {
    falhas += 1;
    console.log(
      `  FALHA  a linha comprida do corpo tem ${LINHA_COMPRIDA.length} caracteres, e precisa ` +
        "passar de 100 para medir o `body-max-line-length`",
    );
  }

  // Em lotes, para não abrir vinte e um processos de uma vez num runner de
  // dois núcleos.
  const resultados = [];
  for (let i = 0; i < casos.length; i += 6) {
    const lote = casos.slice(i, i + 6);
    resultados.push(...(await Promise.all(lote.map((caso) => rodar(caso.mensagem)))));
  }

  casos.forEach((caso, i) => {
    const { passou, saida } = resultados[i];
    const esperado = caso.espera === "passa";
    if (passou === esperado) {
      console.log(`  ok     ${caso.espera === "passa" ? "passa " : "recusa"}  ${caso.nome}`);
      return;
    }
    falhas += 1;
    console.log(`  FALHA  ${esperado ? "devia passar" : "devia ser recusada"}  ${caso.nome}`);
    console.log(`         ${caso.porque}`);
    console.log(
      saida
        .trim()
        .split("\n")
        .map((linha) => `         │ ${linha}`)
        .join("\n"),
    );
  });

  console.log(
    falhas === 0
      ? `\nA exceção abre as ${DELE_DE_VERDADE.length} mensagens dele e recusa as mutações.`
      : `\n${falhas} caso(s) fora do esperado — a exceção está larga ou estreita demais.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

await main();
