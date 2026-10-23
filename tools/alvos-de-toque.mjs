// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Mede o alvo de toque **renderizado**, num navegador de verdade (RNF-08).
 *
 *   node tools/alvos-de-toque.mjs
 *
 * **Isto converte um limite declarado em medida.** O portão em jsdom
 * (`alvo-de-toque.spec.tsx`) diz de si mesmo, desde que foi escrito, que o
 * jsdom não tem motor de diagramação: toda altura computada volta `0px`, e um
 * teste que lesse `getBoundingClientRect` ali passaria sempre, provando nada.
 * Ele verifica a **classe declarada**, e registra que *"a medida real depende
 * de navegador, e fica para o ensaio de usabilidade de novembro"*.
 *
 * O navegador chegou antes de novembro, com o ADR-0015. Esta ferramenta é a
 * outra metade: o mesmo conjunto de controles, medido onde há pixel.
 *
 * **O seletor é o mesmo do portão em jsdom, de propósito.** Dois recortes
 * diferentes dariam dois números que ninguém consegue comparar — e o projeto
 * já escreveu, sobre as verificações de acessibilidade, que elas são
 * construídas sobre o mesmo conjunto de telas justamente para não cobrirem
 * fatias diferentes. Link dentro de frase continua fora: não é alvo de toque
 * primário, e a própria WCAG 2.5.8 o excetua.
 *
 * **O que a classe declarada não alcança e o pixel alcança:** `min-h` perdido
 * para um `h` menor na mesma classe, controle dentro de contêiner que o
 * encolhe, ícone que o texto espreme, e qualquer altura que venha de
 * preenchimento em vez de declaração. É por isso que a medida tem valor
 * próprio e não substitui o portão: um vê o mecanismo, o outro vê o
 * resultado.
 */
import { chromium } from "playwright";

import { TELAS, argumento, abrir, contextoAutenticado, responde } from "./telas.mjs";

/**
 * O piso vem do RNF-08 e da seção 5.2 do Relatório, não da WCAG.
 *
 * O critério 2.5.8 da WCAG 2.2 pede 24 × 24 no nível AA; os 44 são o 2.5.5
 * (AAA) e a recomendação das duas plataformas móveis. **Medir contra o número
 * que o próprio documento promete** é o que mantém documento e produto na
 * mesma história.
 */
const PISO = 44;

/** Os mesmos controles do portão em jsdom. Link dentro de frase não é alvo. */
const CONTROLES = 'button, select, input:not([type="hidden"]), [role="button"]';

const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const email = argumento("email", "dono@arena.com");
const senha = argumento("senha", "rally123");
const api = argumento("api", process.env.API_URL ?? "http://localhost:3333/api/v1")
  .replace(/\/$/, "");

const navegador = await chromium.launch();
let falhas = 0;
let medidos = 0;
try {
  if (!(await responde(base))) {
    console.error(`a web não respondeu em ${base}.`);
    process.exit(1);
  }
  if (!(await responde(`${api}/health`))) {
    console.error(`a API não respondeu em ${api}/health.`);
    process.exit(1);
  }

  // Sem `deviceScaleFactor`: a medida é em pixels de CSS, que é a unidade do
  // critério. Dobrar a densidade não muda o alvo que o dedo encontra.
  const publicas = await navegador.newContext();
  const semSessao = await publicas.newPage();
  // Uma sessao para todos os portoes: o login da API aceita dez por minuto,
  // e a conta nao pode crescer a cada medida nova.
  const { pagina: comSessao, id } = await contextoAutenticado(navegador, base, email, senha);

  for (const tela of TELAS) {
    const pagina = tela.login ? comSessao : semSessao;
    const rota = tela.rota.replace(":id", id);
    await abrir(pagina, tela, base + rota);

    const { curtos, total } = await pagina.evaluate(
      ([seletor, piso]) => {
        const curtos = [];
        let total = 0;
        for (const el of document.querySelectorAll(seletor)) {
          const r = el.getBoundingClientRect();
          // Controle escondido nao e alvo de toque: medir um `display: none`
          // daria zero e encheria o relatorio de falha que ninguem toca.
          if (r.width === 0 && r.height === 0) continue;
          total++;
          if (r.height >= piso && r.width >= piso) continue;
          const nome =
            el.getAttribute("aria-label") ||
            (el.textContent || "").trim().slice(0, 40) ||
            el.getAttribute("name") ||
            el.getAttribute("type") ||
            el.tagName.toLowerCase();
          curtos.push({
            nome,
            tag: el.tagName.toLowerCase(),
            altura: Math.round(r.height * 10) / 10,
            largura: Math.round(r.width * 10) / 10,
          });
        }
        return { curtos, total };
      },
      [CONTROLES, PISO],
    );
    medidos += total;
    const marca = curtos.length === 0 ? "ok  " : "FALHA";
    console.log(`${marca} ${String(total).padStart(3)} controles  ${rota}`);
    for (const c of curtos) {
      falhas++;
      console.log(
        `        ${c.largura} × ${c.altura} px  <${c.tag}> "${c.nome}"`,
      );
    }
  }
} finally {
  await navegador.close();
}

console.log();
// Âncora: zero controles medidos significaria seletor quebrado, e aí a
// ausência de falha acima não provaria nada — o defeito que o próprio portão
// em jsdom declara ter evitado com a contagem mínima dele.
if (medidos === 0) {
  console.error("ERRO: nenhum controle medido. O seletor quebrou.");
  process.exit(2);
}
console.log(`${medidos} controles medidos, piso de ${PISO} px.`);
if (falhas > 0) {
  console.error(`${falhas} abaixo do piso.`);
  process.exit(1);
}
console.log("nenhum abaixo do piso.");
