// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * **O portão das mensagens de commit, e a única exceção que ele abre.**
 *
 * A convenção é `@commitlint/config-conventional` inteiro, sem relaxamento:
 * cabeçalho de até 100 caracteres, linhas de corpo de até 100, tipo conhecido,
 * e assunto que não começa com maiúscula. Quem escreve commit aqui é gente, e
 * a regra vale para toda ela.
 *
 * **Menos para o Dependabot, que não consegue obedecer.** Ele escreve
 * `chore(deps): Bump x from 1.2.3 to 4.0.0` — "Bump" com maiúscula, que cai no
 * `subject-case` — e põe no corpo as notas de versão em markdown, com linhas
 * de link bem passadas de 100 caracteres, que caem no `body-max-line-length`.
 * O `.github/dependabot.yml` permite escolher o prefixo e o escopo da
 * mensagem, e **nada além disso**: não há como pedir "bump" minúsculo nem
 * corpo estreito. Então ou a exceção existe, ou todo PR dele nasce vermelho.
 *
 * E nasceu: em 26/10 havia **dezesseis** PRs de dependência abertos, todos com
 * o mesmo `✖ Mensagens de commit`, por estes dois motivos e nenhum outro. O
 * preço não foi o vermelho em si — foi o **sinal perdido**. Com dezesseis
 * portões caídos pela mensagem, não dava para olhar a lista e dizer qual
 * daqueles majors realmente quebra a compilação, que é a única pergunta que
 * importa num PR de dependência. Um portão que ninguém pode passar não protege
 * nada; só esconde os outros.
 *
 * E a resposta estava logo ali: lendo **quais** portões cada um derrubava,
 * sete dos quinze caíam só pela mensagem e passavam em todo o resto, e oito
 * quebram de verdade — `tailwindcss` 4 e `typescript` 6 derrubam o build da
 * web, três majors do Nest derrubam a API junto com as migrações, e três
 * pacotes Flutter derrubam o app. Metade do vermelho era o portão falando de
 * si mesmo.
 *
 * **A exceção pede as duas coisas juntas, e é por isso que ela é estreita.**
 * O cabeçalho tem de ter a forma que o `dependabot.yml` manda ele escrever,
 * *e* a mensagem tem de trazer a assinatura que ele põe em tudo que abre. Uma
 * só não basta:
 *
 * - só o cabeçalho, e qualquer pessoa escrevendo `chore(deps): Bump ...`
 *   escaparia da convenção inteira à mão — o atalho mais fácil de descobrir
 *   por acidente;
 * - só a assinatura, e ela viraria chave-mestra: bastaria colá-la no rodapé
 *   para um `feat: Qualquer Coisa Assim` passar.
 *
 * Forjar as duas é possível e é mentir de propósito, que é outro problema.
 * Errar por descuido, não é.
 *
 * `tools/confere-commitlint.mjs` prova isso contra o próprio commitlint — as
 * mensagens reais dos dezesseis PRs passam, e as mutações delas continuam
 * sendo recusadas.
 */

/** A assinatura que o Dependabot põe em todo commit que abre. */
const ASSINATURA_DO_DEPENDABOT = "Signed-off-by: dependabot[bot] <support@github.com>";

/**
 * O cabeçalho que o `.github/dependabot.yml` manda ele escrever — `prefix:
 * "chore"` com `include: "scope"` dá `chore(deps)`, e o escopo vira
 * `deps-dev` quando a dependência é de desenvolvimento. O `\S` no fim exige
 * que haja nome de pacote depois de "Bump".
 */
const CABECALHO_DO_DEPENDABOT = /^chore\(deps(-dev)?\): Bump \S/;

/**
 * Recebe a mensagem **inteira** (cabeçalho, corpo e rodapé), que é o que o
 * commitlint entrega aos `ignores` — e é o que permite exigir a assinatura,
 * que vive no rodapé.
 */
function ehDoDependabot(mensagem) {
  const texto = String(mensagem);
  const [cabecalho = ""] = texto.split("\n");
  return CABECALHO_DO_DEPENDABOT.test(cabecalho) && texto.includes(ASSINATURA_DO_DEPENDABOT);
}

module.exports = {
  extends: ["@commitlint/config-conventional"],
  // `defaultIgnores` continua ligado: commits de merge e de revert já eram
  // dispensados antes desta exceção, e seguem sendo.
  ignores: [ehDoDependabot],
};
