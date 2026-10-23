// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Cobra **nome acessível** de todo controle das telas de verdade (RNF-08).
 *
 *   node tools/nome-acessivel.mjs
 *
 * **O portão em jsdom mede cenário; este mede tela.** O
 * `nome-acessivel.spec.tsx` monta os componentes do `cenario.tsx` com props
 * fabricadas e calcula o nome com o `dom-accessibility-api`. Isso deixa duas
 * lacunas, e nenhuma delas é defeito daquele portão — são o limite do jsdom:
 *
 * **Controle que só existe quando há dado não é alcançado.** O cenário monta
 * o componente com o que a prop entrega; a tela real traz as linhas do seed,
 * e com elas os controles por linha — mover, cancelar, bloquear, pular
 * semana. É ali que mora o botão sem rótulo, porque é o controle que ninguém
 * olha de perto.
 *
 * **O nome vem de uma implementação, não do navegador.** O
 * `dom-accessibility-api` implementa a especificação *Accessible Name and
 * Description Computation*, e implementa bem; mas quem anuncia ao leitor de
 * tela é o navegador, e é a árvore dele que esta ferramenta lê, pelo
 * `ariaSnapshot` do Playwright.
 *
 * **O recorte é o mesmo do portão em jsdom, e não o do alvo de toque.** Aqui
 * o link entra: `a[href]` precisa de nome pelos critérios 2.4.4 e 4.1.2,
 * enquanto a medida de alvo o excetua pelo 2.5.8. Dois critérios diferentes
 * admitem dois recortes diferentes — o que não se admite é um recorte que não
 * corresponde a nenhum portão, porque aí os números não se comparam com nada.
 *
 * **Esta metade não é a mais forte, e isso foi medido.** Tirando o `<label>`
 * do campo de e-mail da tela de entrada e mantendo o `placeholder`, os dois
 * portões discordam: o de jsdom acusa **campo sem nome**, e este **não** —
 * porque o Chromium usa o `placeholder` como nome de última instância, o que
 * a especificação *HTML Accessibility API Mappings* lhe permite, e o
 * `dom-accessibility-api` é mais estrito. Nenhum dos dois está errado; eles
 * medem coisas diferentes.
 *
 * É daí que vem a exigência de **rótulo associado** abaixo, e ela é o que
 * sobra de verdade: um campo com `placeholder` e nada mais **tem nome** para
 * o navegador e fica anônimo para a pessoa no instante em que ela digita a
 * primeira letra. Com o rótulo quebrado, as duas metades reprovam — uma pelo
 * nome, a outra pelo rótulo.
 *
 * **O outro limite honesto:** esta ferramenta vê o que a tela renderiza em
 * repouso. Controle dentro de formulário fechado — o de mover reserva, por
 * exemplo — só entra quando algo o abre, e abrir cada um é ensaio de
 * interação, não varredura. O portão em jsdom cobre esses, porque o cenário
 * os monta abertos. **As duas metades se completam, e é por isso que nenhuma
 * delas substitui a outra.**
 */
import { chromium } from "playwright";

import { TELAS, argumento, abrir, entrar, responde } from "./telas.mjs";

/** Os mesmos controles do portão em jsdom, link incluído. */
const CONTROLES = [
  "button",
  "select",
  "textarea",
  'input:not([type="hidden"])',
  "a[href]",
  '[role="button"]',
].join(", ");

/**
 * Campos que precisam de **rótulo**, e não apenas de nome.
 *
 * A exigência a mais vem do portão em jsdom, e a razão é a mesma: é o rótulo
 * que continua visível depois do preenchimento, e é ele que amplia a área
 * clicável do campo. `placeholder` desaparece quando a pessoa começa a
 * digitar, de modo que nome vindo dele deixa o campo anônimo justo quando há
 * o que conferir.
 */
const CAMPOS =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea';

const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const email = argumento("email", "dono@arena.com");
const senha = argumento("senha", "rally123");
const api = argumento("api", process.env.API_URL ?? "http://localhost:3333/api/v1").replace(
  /\/$/,
  "",
);

/**
 * O nome que o navegador anuncia, extraído do `ariaSnapshot` do elemento.
 *
 * O instantâneo de um controle sai como `- button "Entrar"`, e às vezes com
 * linhas de propriedade abaixo. Interessa a primeira linha: o papel e, entre
 * aspas, o nome. Sem aspas, o navegador não computou nome nenhum.
 */
function nomeDoInstantaneo(snap) {
  const primeira = String(snap).split("\n")[0] ?? "";
  const papel = primeira.match(/^\s*-\s*([a-z]+)/)?.[1] ?? "?";
  const nome = primeira.match(/"((?:[^"\\]|\\.)*)"/)?.[1] ?? "";
  return { papel, nome: nome.trim() };
}

/** Identifica o controle no relatório, sem depender de ter nome. */
async function descrever(controle) {
  return controle.evaluate((el) => {
    const tipo = el.getAttribute("type");
    const marca = `<${el.tagName.toLowerCase()}${tipo ? ` type="${tipo}"` : ""}>`;
    const dica =
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      el.getAttribute("href") ||
      (el.textContent || "").trim().slice(0, 30) ||
      el.className.toString().slice(0, 40);
    return dica ? `${marca} ${dica}` : marca;
  });
}

const navegador = await chromium.launch();
let medidos = 0;
let semNome = 0;
let semRotulo = 0;
let foraDaArvore = 0;
try {
  if (!(await responde(base))) {
    console.error(`a web não respondeu em ${base}.`);
    process.exit(1);
  }
  if (!(await responde(`${api}/health`))) {
    console.error(`a API não respondeu em ${api}/health.`);
    process.exit(1);
  }

  const publicas = await navegador.newContext();
  const semSessao = await publicas.newPage();
  const privadas = await navegador.newContext();
  const comSessao = await privadas.newPage();
  const id = await entrar(comSessao, base, email, senha);

  for (const tela of TELAS) {
    const pagina = tela.login ? comSessao : semSessao;
    const rota = tela.rota.replace(":id", id);
    await abrir(pagina, tela, base + rota);

    const problemas = [];
    const controles = await pagina.locator(CONTROLES).all();
    let naTela = 0;

    for (const controle of controles) {
      // Controle escondido não é anunciado, e medi-lo encheria o relatório de
      // falha que ninguém alcança.
      const caixa = await controle.boundingBox();
      if (!caixa || (caixa.width === 0 && caixa.height === 0)) continue;
      naTela++;

      const instantaneo = await controle.ariaSnapshot();
      if (!String(instantaneo).trim()) {
        // Fora da árvore de acessibilidade: existe na tela, e o leitor não o
        // vê. É achado próprio, e não ausência de nome.
        foraDaArvore++;
        problemas.push(`fora da árvore de acessibilidade  ${await descrever(controle)}`);
        continue;
      }
      const { papel, nome } = nomeDoInstantaneo(instantaneo);
      if (!nome) {
        semNome++;
        problemas.push(`sem nome (papel ${papel})  ${await descrever(controle)}`);
      }
    }
    medidos += naTela;

    // Rótulo associado é estrutura, e por isso é lido do DOM e não da árvore:
    // o navegador computa o **nome**, mas não diz de onde ele veio.
    const anonimos = await pagina.evaluate((seletor) => {
      const achados = [];
      for (const el of document.querySelectorAll(seletor)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const temAria = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
        const id = el.getAttribute("id");
        const temLabel =
          (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest("label");
        if (temAria || temLabel) continue;
        const tipo = el.getAttribute("type");
        achados.push(
          `<${el.tagName.toLowerCase()}${tipo ? ` type="${tipo}"` : ""}> ` +
            (el.getAttribute("name") || el.getAttribute("placeholder") || "sem pista"),
        );
      }
      return achados;
    }, CAMPOS);
    for (const campo of anonimos) {
      semRotulo++;
      problemas.push(`campo sem rótulo associado  ${campo}`);
    }

    const marca = problemas.length === 0 ? "ok  " : "FALHA";
    console.log(`${marca} ${String(naTela).padStart(3)} controles  ${rota}`);
    for (const p of problemas) console.log(`        ${p}`);
  }
} finally {
  await navegador.close();
}

console.log();
// Âncora: seletor quebrado varre nada e passa, que é o defeito que o portão
// em jsdom evita com a contagem mínima dele.
if (medidos === 0) {
  console.error("ERRO: nenhum controle medido. O seletor quebrou.");
  process.exit(2);
}
console.log(`${medidos} controles medidos nas ${TELAS.length} telas.`);
const falhas = semNome + semRotulo + foraDaArvore;
if (falhas > 0) {
  console.error(
    `${semNome} sem nome acessível, ${semRotulo} campo(s) sem rótulo associado, ` +
      `${foraDaArvore} fora da árvore de acessibilidade.`,
  );
  process.exit(1);
}
console.log("todo controle tem nome, e todo campo tem rótulo associado.");
