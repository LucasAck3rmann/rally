// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Mede o contraste **renderizado**, num navegador de verdade (RNF-08, WCAG 1.4.3).
 *
 *   node tools/contraste.mjs
 *
 * **O portão em jsdom mede par declarado; este mede par desenhado.** O
 * `contraste.spec.tsx` percorre duas listas escritas à mão — doze pares de
 * texto e três de componente — e diz de si mesmo que *"par novo na interface
 * entra na lista; é o único jeito de ela continuar dizendo a verdade"*. É uma
 * dependência de quem escreve se lembrar: ninguém reprova se amanhã um
 * `gray` for desenhado sobre `coral`, porque esse par simplesmente não está
 * na lista. O projeto já corrigiu essa mesma fragilidade duas vezes — na
 * lista de telas, que passou a ser conferida por correspondência, e no alvo
 * de toque, que passou a ser medido onde há pixel.
 *
 * Aqui o recorte não é escolhido: é **todo elemento que pinta texto** nas
 * treze telas. A cor da frente e a do fundo saem do `getComputedStyle`, de
 * modo que par novo entra na medição por existir na tela, e não por alguém
 * ter lembrado dele.
 *
 * **Os dois portões continuam, e medem coisas diferentes.** O de jsdom prova
 * que o Tailwind não copiou os hexes à mão e que a paleta do design system
 * fecha; este prova que a composição real fecha. Um vê o mecanismo, o outro
 * vê o resultado — o mesmo arranjo do alvo de toque.
 *
 * **A fórmula é a mesma do portão em jsdom**, de propósito: duas fórmulas de
 * luminância dariam dois números que ninguém consegue comparar.
 *
 * **O limite honesto desta ferramenta:** fundo com imagem ou gradiente não é
 * cor, e não há razão de contraste para medir. Esses elementos saem como
 * `indeterminado` e são **impressos**, não omitidos — medir a cor que está
 * atrás da imagem e dar aprovado seria exatamente o tipo de aprovação vazia
 * que estas medições existem para evitar.
 */
import { chromium } from "playwright";

import { TELAS, argumento, abrir, entrar, responde } from "./telas.mjs";

/**
 * Os pisos são os da WCAG 2.2 AA, critério 1.4.3.
 *
 * Texto grande tem piso menor porque a norma o define assim: a partir de
 * 24 px, ou de 18,66 px quando em negrito. Aplicar 4,5 a um título de 48 px
 * reprovaria combinação que a norma aprova, e portão que reprova o certo é
 * portão que alguém desliga.
 */
const PISO_NORMAL = 4.5;
const PISO_GRANDE = 3;

/** Abaixo disto o elemento não é texto visível, e sim caixa de leitor de tela. */
const LADO_MINIMO = 4;

const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const email = argumento("email", "dono@arena.com");
const senha = argumento("senha", "rally123");
const api = argumento("api", process.env.API_URL ?? "http://localhost:3333/api/v1").replace(
  /\/$/,
  "",
);

/**
 * O que roda dentro da página.
 *
 * Vai como função serializada para o `evaluate`, e por isso é autocontida:
 * nada daqui alcança o escopo do Node.
 */
function medirNaPagina([pisoNormal, pisoGrande, ladoMinimo]) {
  /** `rgb(a)` do navegador para canais numéricos. */
  function cor(texto) {
    const n = texto.match(/[\d.]+/g);
    if (!n) return null;
    return {
      r: Number(n[0]),
      g: Number(n[1]),
      b: Number(n[2]),
      a: n[3] === undefined ? 1 : Number(n[3]),
    };
  }

  /** Mistura a frente sobre o fundo conforme a opacidade da frente. */
  function sobrepor(frente, fundo) {
    const a = frente.a;
    return {
      r: frente.r * a + fundo.r * (1 - a),
      g: frente.g * a + fundo.g * (1 - a),
      b: frente.b * a + fundo.b * (1 - a),
      a: 1,
    };
  }

  function luminancia(c) {
    const [r, g, b] = [c.r, c.g, c.b].map((v) => {
      const x = v / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function razao(a, b) {
    const [la, lb] = [luminancia(a), luminancia(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * Sobe a árvore até achar o fundo que de fato está atrás do texto.
   *
   * Fundo transparente é o caso comum, não a exceção: a maioria dos
   * elementos não declara cor de fundo nenhuma e herda visualmente a do
   * contêiner. Camada semitransparente encontrada no caminho é empilhada e
   * misturada no fim, na ordem em que aparece.
   */
  function fundoEfetivo(el) {
    const camadas = [];
    let atual = el;
    while (atual) {
      const cs = getComputedStyle(atual);
      if (cs.backgroundImage !== "none") return { indeterminado: true };
      const c = cor(cs.backgroundColor);
      if (c && c.a === 1) {
        let base = c;
        for (let i = camadas.length - 1; i >= 0; i--) base = sobrepor(camadas[i], base);
        return { cor: base };
      }
      if (c && c.a > 0) camadas.push(c);
      atual = atual.parentElement;
    }
    // Sem nenhum fundo opaco até a raiz: o que aparece é o branco da tela.
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = camadas.length - 1; i >= 0; i--) base = sobrepor(camadas[i], base);
    return { cor: base };
  }

  /** Opacidade acumulada do elemento e de todos os ancestrais. */
  function opacidadeEfetiva(el) {
    let o = 1;
    let atual = el;
    while (atual) {
      o *= Number(getComputedStyle(atual).opacity);
      atual = atual.parentElement;
    }
    return o;
  }

  /** Verdadeiro quando o elemento tem texto próprio, e não só texto de filhos. */
  function pintaTexto(el) {
    for (const no of el.childNodes) {
      if (no.nodeType === Node.TEXT_NODE && no.textContent.trim().length > 0) return true;
    }
    return false;
  }

  /**
   * Texto puramente decorativo, que a WCAG 1.4.3 isenta de contraste.
   *
   * **A isenção não é uma lista mantida aqui.** Seria lista alimentada à mão,
   * que é o defeito que esta ferramenta existe para corrigir. Quem declara é
   * a própria marcação: `aria-hidden="true"` diz que aquele texto não é
   * conteúdo, e o wordmark gigante do rodapé já o declarava por conta
   * própria, com o comentário de que é acabamento editorial. Tirar o
   * `aria-hidden` devolve o texto à condição de conteúdo, e a medição volta a
   * cobrá-lo — é correspondência, e não exceção.
   */
  function decorativo(el) {
    return el.closest('[aria-hidden="true"]') !== null;
  }

  const reprovados = [];
  const indeterminados = [];
  let total = 0;

  let decorativos = 0;
  for (const el of document.body.querySelectorAll("*")) {
    if (!pintaTexto(el)) continue;
    if (decorativo(el)) {
      decorativos++;
      continue;
    }

    const cs = getComputedStyle(el);
    if (cs.visibility !== "visible") continue;
    const r = el.getBoundingClientRect();
    if (r.width < ladoMinimo || r.height < ladoMinimo) continue;

    const opacidade = opacidadeEfetiva(el);
    // Texto totalmente transparente não é texto visível.
    if (opacidade === 0) continue;

    const rotulo = el.textContent.trim().replace(/\s+/g, " ").slice(0, 44);
    const fundo = fundoEfetivo(el);
    if (fundo.indeterminado) {
      indeterminados.push({ tag: el.tagName.toLowerCase(), rotulo });
      continue;
    }

    const frente = cor(cs.color);
    if (!frente) continue;
    total++;

    const efetiva = sobrepor({ ...frente, a: frente.a * opacidade }, fundo.cor);
    const tamanho = parseFloat(cs.fontSize);
    const peso = Number(cs.fontWeight) || 400;
    const grande = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700);
    const piso = grande ? pisoGrande : pisoNormal;
    const medida = razao(efetiva, fundo.cor);

    if (medida + 0.005 >= piso) continue;
    const hex = (c) =>
      "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    reprovados.push({
      tag: el.tagName.toLowerCase(),
      rotulo,
      razao: Math.round(medida * 100) / 100,
      piso,
      frente: hex(efetiva),
      fundo: hex(fundo.cor),
      tamanho: Math.round(tamanho * 10) / 10,
      peso,
    });
  }

  return { reprovados, indeterminados, decorativos, total };
}

const navegador = await chromium.launch();
let falhas = 0;
let medidos = 0;
let semCor = 0;
let isentos = 0;
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

    const { reprovados, indeterminados, decorativos, total } = await pagina.evaluate(
      medirNaPagina,
      [PISO_NORMAL, PISO_GRANDE, LADO_MINIMO],
    );
    medidos += total;
    semCor += indeterminados.length;
    isentos += decorativos;

    const marca = reprovados.length === 0 ? "ok  " : "FALHA";
    const partes = [];
    if (indeterminados.length) partes.push(`${indeterminados.length} sobre imagem`);
    if (decorativos) partes.push(`${decorativos} decorativo`);
    const nota = partes.length ? `  (${partes.join(", ")})` : "";
    console.log(`${marca} ${String(total).padStart(4)} textos  ${rota}${nota}`);
    for (const c of reprovados) {
      falhas++;
      console.log(
        `        ${c.razao.toFixed(2)}:1 < ${c.piso}  ${c.frente} sobre ${c.fundo}  ` +
          `${c.tamanho}px/${c.peso}  <${c.tag}> "${c.rotulo}"`,
      );
    }
  }
} finally {
  await navegador.close();
}

console.log();
// Âncora: zero textos medidos significaria que o percurso quebrou, e aí a
// ausência de reprovação acima não provaria nada.
if (medidos === 0) {
  console.error("ERRO: nenhum texto medido. O percurso quebrou.");
  process.exit(2);
}
console.log(
  `${medidos} textos medidos, piso de ${PISO_NORMAL}:1 ` + `(${PISO_GRANDE}:1 para texto grande).`,
);
if (semCor > 0) {
  console.log(`${semCor} sobre imagem ou gradiente, sem razão de contraste para medir.`);
}
// O número de isentos é impresso porque isenção calada cresce sem ninguém
// ver: se amanhã meia tela estiver sob `aria-hidden`, a conta aparece aqui.
if (isentos > 0) {
  console.log(`${isentos} declarados decorativos pela própria marcação.`);
}
if (falhas > 0) {
  console.error(`${falhas} abaixo do piso.`);
  process.exit(1);
}
console.log("nenhum abaixo do piso.");
