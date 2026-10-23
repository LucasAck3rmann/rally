// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Percorre as telas **pelo teclado** e mede o foco onde há pixel (RNF-08).
 *
 *   node tools/foco.mjs
 *
 * **O portão em jsdom declara a lacuna que esta ferramenta fecha.** Ele
 * verifica que ninguém removeu o contorno global, que a cor declarada dele
 * tem contraste suficiente e que a ordem não é sabotada por `tabindex`
 * positivo. E diz de si mesmo que **não** verifica se a ordem de foco
 * acompanha a ordem visual, *"porque isso depende de posição na tela, o jsdom
 * não tem motor de layout, e um teste que fingisse medir isso passaria
 * provando nada"*.
 *
 * Aqui há posição, e há teclado de verdade: o percurso é feito com `Tab`, e
 * não chamando `focus()`. A diferença não é cosmética — o `:focus-visible`,
 * que é quem pinta o contorno, distingue foco vindo do teclado de foco dado
 * por programa. Medir com `focus()` mediria um estado que a pessoa nunca vê.
 *
 * Três medidas, e cada uma responde a uma pergunta que a declaração do CSS
 * não responde:
 *
 * **1. O controle é alcançado?** (WCAG 2.1.1) Controle visível que o `Tab`
 * nunca alcança é controle que existe para o mouse e não para o teclado. A
 * classe declarada não diz isso: diz que o elemento é focalizável, não que
 * ele está no caminho.
 *
 * **2. O indicador é pintado?** (2.4.7) O portão em jsdom prova que o CSS
 * **declara** um contorno bom. Entre a declaração e o pixel cabem
 * especificidade, `overflow: hidden` que corta o contorno e regra posterior
 * que o zera. Aqui o estilo do controle focado é comparado com o dele mesmo
 * sem foco: se nada muda, não há indicador, por mais correto que esteja o
 * `globals.css`.
 *
 * **3. A ordem segue a tela?** (2.4.3) É a lacuna declarada.
 *
 * **O critério do salto para trás é deliberadamente conservador.** Só acusa
 * quando o próximo controle está **acima e à esquerda** do anterior — um
 * retrocesso nos dois eixos. Leitura estrita de cima para baixo reprovaria a
 * passagem da barra lateral para o conteúdo, que sobe em `y` e avança em `x`
 * e é ordem correta num layout de duas colunas. Portão que reprova o certo é
 * portão que alguém desliga; este prefere acusar menos e acertar sempre.
 */
import { chromium } from "playwright";

import { TELAS, argumento, abrir, contextoAutenticado, responde } from "./telas.mjs";

/**
 * Os focalizáveis do portão em jsdom, **mais o `summary`**, menos o que o
 * `Tab` não alcança.
 *
 * `tabindex="-1"` é focalizável por programa e **fora** da navegação por
 * teclado de propósito; cobrá-lo aqui reprovaria um padrão correto. O
 * desabilitado sai pelo mesmo motivo.
 *
 * **O `summary` entrou por medição.** A primeira execução acusou seis links
 * do rodapé como inalcançáveis, e eram falso positivo desta ferramenta: o
 * percurso real da página inicial tem 31 paradas, sete delas em `<summary>`
 * das perguntas frequentes. O `summary` é parada de teclado nativa e não
 * estava no seletor, de modo que as sete paradas gastavam orçamento sem
 * entrar na conta, e o percurso acabava antes do rodapé. Contar errado o que
 * se percorre é o mesmo defeito que medir a tela errada.
 */
const FOCALIZAVEIS =
  'a[href], button, select, textarea, input:not([type="hidden"]), [tabindex], [role="button"], summary';

/** Folga em pixels para "acima": linha da mesma altura não conta como retrocesso. */
const FOLGA = 4;

/** Alfa de uma cor computada; `transparent` chega como `rgba(0, 0, 0, 0)`. */
function alfa(cor) {
  const n = String(cor).match(/[\d.]+/g);
  return !n ? 1 : n[3] === undefined ? 1 : Number(n[3]);
}

/**
 * Se o contorno é **pintado**, e não apenas declarado.
 *
 * **Mudar de estilo não é aparecer.** O utilitário `outline-none` do Tailwind
 * não zera o contorno: ele escreve `outline: 2px solid transparent`. Um
 * comparador de strings vê diferença entre o estado sem foco e o com foco, dá
 * o indicador por existente, e o controle fica sem nada visível — que é
 * exatamente o defeito que o portão em jsdom foi escrito para pegar, com oito
 * ocorrências na época. Foi uma mutação que revelou esta falha no critério:
 * acrescentar `focus-visible:outline-none` a um botão passava calado.
 */
function contornoVisivel(e) {
  return e.os !== "none" && parseFloat(e.ow) > 0 && alfa(e.oc) > 0;
}

/** Se o foco acrescenta algo que a pessoa enxerga. */
function pintouIndicador(com, sem) {
  const ganhouContorno = contornoVisivel(com) && !contornoVisivel(sem);
  const mudouSombra = com.bs !== sem.bs && com.bs !== "none";
  return ganhouContorno || mudouSombra;
}

const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const email = argumento("email", "dono@arena.com");
const senha = argumento("senha", "rally123");
const api = argumento("api", process.env.API_URL ?? "http://localhost:3333/api/v1").replace(
  /\/$/,
  "",
);

/** Marca os candidatos e devolve o estado deles **sem foco**. */
function prepararNaPagina([seletor]) {
  const candidatos = [];
  let i = 0;
  for (const el of document.querySelectorAll(seletor)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (el.hasAttribute("disabled")) continue;
    if (el.getAttribute("tabindex") === "-1") continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") continue;

    el.setAttribute("data-foco-i", String(i));
    const nome =
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34) ||
      el.getAttribute("name") ||
      el.tagName.toLowerCase();
    candidatos.push({
      i,
      nome,
      tag: el.tagName.toLowerCase(),
      semFoco: {
        ow: cs.outlineWidth,
        os: cs.outlineStyle,
        oc: cs.outlineColor,
        bs: cs.boxShadow,
      },
    });
    i++;
  }
  return candidatos;
}

/** O que está focado agora: quem é, onde está e como está pintado. */
function focadoNaPagina() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const indice = el.getAttribute("data-foco-i");
  return {
    i: indice === null ? null : Number(indice),
    tag: el.tagName.toLowerCase(),
    nome:
      el.getAttribute("aria-label") ||
      (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34) ||
      el.getAttribute("name") ||
      el.tagName.toLowerCase(),
    // `pageY` e não `y`: a página rola durante o percurso, e comparar
    // coordenadas de viewport entre passos faria a rolagem parecer salto.
    x: Math.round(r.left + window.scrollX),
    y: Math.round(r.top + window.scrollY),
    comFoco: {
      ow: cs.outlineWidth,
      os: cs.outlineStyle,
      oc: cs.outlineColor,
      bs: cs.boxShadow,
    },
  };
}

/** Tira as marcas, para a página voltar ao que era. */
function limparNaPagina() {
  for (const el of document.querySelectorAll("[data-foco-i]")) {
    el.removeAttribute("data-foco-i");
  }
}

const navegador = await chromium.launch();
let medidos = 0;
let semIndicador = 0;
let inalcancados = 0;
let saltos = 0;
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
  const { pagina: comSessao, id } = await contextoAutenticado(navegador, base, email, senha);

  for (const tela of TELAS) {
    const pagina = tela.login ? comSessao : semSessao;
    const rota = tela.rota.replace(":id", id);
    await abrir(pagina, tela, base + rota);

    const candidatos = await pagina.evaluate(prepararNaPagina, [FOCALIZAVEIS]);
    const problemas = [];
    const visitados = new Map();
    let anterior = null;
    let primeiro = null;

    // **O orçamento conta teclas, e não candidatos.** Parada em elemento fora
    // do seletor gasta tecla sem entrar na conta, e um orçamento apertado faz
    // o percurso acabar no meio e acusar de inalcançável o que só não foi
    // alcançado ainda. Foi o que aconteceu na primeira execução. A folga é
    // larga de propósito; quem encerra o laço é a volta completa ou a saída da
    // página, não o teto.
    for (let passo = 0; passo < candidatos.length * 2 + 20; passo++) {
      await pagina.keyboard.press("Tab");
      const atual = await pagina.evaluate(focadoNaPagina);
      if (!atual) break;

      // **Voltar ao mesmo elemento não é dar a volta.** Um
      // `input[type="date"]` consome quatro paradas de `Tab` — dia, mês, ano
      // e o botão de calendário — e em todas elas o `activeElement` é o mesmo
      // campo. Tratar a repetição como ciclo encerrava o percurso no primeiro
      // campo de data, e os controles depois dele eram acusados de
      // inalcançáveis. Volta completa é reencontrar o **primeiro** depois de
      // ter passado por outros.
      if (atual.i !== null) {
        if (primeiro === null) primeiro = atual.i;
        else if (atual.i === primeiro && visitados.size > 1) break;
        // **O julgamento é do controle, e não de cada parada.** O campo de
        // data tem quatro paradas, e na última o foco está no botão de
        // calendário do shadow DOM: ali o Chromium tira o `:focus-visible` do
        // campo hospedeiro, e ler o estilo dele naquele instante faria um
        // controle que **tem** indicador parecer que não tem. Basta uma
        // parada pintada para o controle estar servido.
        const antes = candidatos[atual.i]?.semFoco;
        const pintouAgora = antes !== undefined && pintouIndicador(atual.comFoco, antes);
        const jaVisto = visitados.get(atual.i);
        visitados.set(atual.i, {
          ...atual,
          pintou: pintouAgora || jaVisto?.pintou === true,
        });
      }

      // Parada dentro do mesmo campo não é movimento de foco, e compará-la
      // consigo mesma acusaria salto de zero pixel.
      if (
        anterior &&
        atual.i !== anterior.i &&
        atual.y < anterior.y - FOLGA &&
        atual.x < anterior.x
      ) {
        saltos++;
        problemas.push(
          `salto para trás  "${anterior.nome}" (${anterior.x},${anterior.y}) → ` +
            `"${atual.nome}" (${atual.x},${atual.y})`,
        );
      }
      anterior = atual;
    }

    for (const parada of visitados.values()) {
      if (parada.pintou) continue;
      semIndicador++;
      problemas.push(
        `sem indicador pintado  <${parada.tag}> "${parada.nome}"  ` +
          `(contorno ${parada.comFoco.ow} ${parada.comFoco.os} ${parada.comFoco.oc})`,
      );
    }

    for (const c of candidatos) {
      if (visitados.has(c.i)) continue;
      inalcancados++;
      problemas.push(`não alcançado pelo Tab  <${c.tag}> "${c.nome}"`);
    }

    await pagina.evaluate(limparNaPagina);
    medidos += candidatos.length;

    const marca = problemas.length === 0 ? "ok  " : "FALHA";
    console.log(
      `${marca} ${String(visitados.size).padStart(3)}/${String(candidatos.length).padEnd(3)} alcançados  ${rota}`,
    );
    for (const p of problemas) console.log(`        ${p}`);
  }
} finally {
  await navegador.close();
}

console.log();
// Âncora: seletor quebrado não percorre nada e passa.
if (medidos === 0) {
  console.error("ERRO: nenhum controle focalizável encontrado. O seletor quebrou.");
  process.exit(2);
}
console.log(
  `${medidos} controles focalizáveis percorridos pelo teclado nas ${TELAS.length} telas.`,
);
const falhas = semIndicador + inalcancados + saltos;
if (falhas > 0) {
  console.error(
    `${inalcancados} fora do caminho do Tab, ${semIndicador} sem indicador pintado, ` +
      `${saltos} salto(s) para trás.`,
  );
  process.exit(1);
}
console.log("todos alcançados, todos com indicador, e nenhum salto para trás.");
