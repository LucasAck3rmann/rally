// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Captura as telas do sistema para as figuras do Relatório (ADR-0015).
 *
 *   node tools/capturas.mjs --saida "../Lucas's Vault/IFSul/Rally/analise/figuras"
 *
 * **Captura por script, e não à mão.** Print manual não se reproduz: muda de
 * tamanho, pega barra de navegador, envelhece sem ninguém notar e não volta
 * igual quando a interface muda. Aqui a largura, a altura e a rota ficam
 * declaradas, de modo que regerar as figuras depois de mexer numa tela é
 * rodar o comando de novo.
 *
 * O navegador é o Chromium que o Playwright baixa, na versão que o
 * `package.json` fixa — mais reprodutível que "o Chrome que a máquina tem":
 * a figura regerada em outra máquina sai do mesmo motor.
 *
 * **Duas sessões, e a ordem importa.** As telas públicas são capturadas numa
 * sessão limpa, **antes** do login. A primeira versão deste script logava
 * primeiro e capturava tudo depois, e `/entrar` com sessão ativa redireciona
 * para o painel: a figura da tela de entrada saiu mostrando o painel. O
 * arquivo tinha 102 KB em vez de 57, e o portão de tamanho mínimo **não
 * pegou** — ele conhece página vazia, não página errada.
 *
 * Por isso cada tela declara um `espera`: o título que precisa estar nela. É
 * a diferença entre "capturou alguma coisa" e "capturou a coisa certa".
 */
import { mkdir, stat, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";

import { TELAS, LARGURA, argumento, abrir, contextoAutenticado, responde } from "./telas.mjs";

const BYTES_MINIMOS = 8 * 1024;

const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const saida = resolve(argumento("saida", "figuras"));
// Credenciais do `prisma/seed.ts`, que é onde elas são declaradas: repetir o
// valor aqui criaria a segunda cópia de uma verdade.
const email = argumento("email", "dono@arena.com");
const senha = argumento("senha", "rally123");
const somenteSemLogin = process.argv.includes("--sem-login");
// A API nao e desenhada aqui, mas o login depende dela. Na CI os dois
// servidores sobem em paralelo e o portao corre logo atras: sem esperar,
// falharia **as vezes** -- a pior frequencia possivel, rara o bastante para
// virar "instabilidade" e ser reexecutada sem olhar.
const api = argumento("api", process.env.API_URL ?? "http://localhost:3333/api/v1").replace(
  /\/$/,
  "",
);
// **Modo portão:** abre cada tela e cobra o título, sem salvar arquivo. É o
// mesmo percurso da captura, porque a lista de telas tem de ser uma só — e
// serve à CI, que não quer as imagens e quer a garantia.
const semSalvar = process.argv.includes("--sem-salvar");

/** Abre a tela, cobra o título e — quando há arquivo — fotografa. */
async function capturar(pagina, tela, url, destino) {
  if (destino) await mkdir(dirname(destino), { recursive: true });

  // `abrir` navega e cobra o título. Mora no módulo das telas porque o
  // medidor de alvo de toque precisa do mesmo percurso, e duas cópias dele
  // divergiriam na primeira vez que um título mudasse.
  await abrir(pagina, tela, url);

  // Sem arquivo a salvar o trabalho acaba aqui: o portão queria o título, e
  // ele apareceu. É o que a CI roda, e por isso ela não precisa de disco
  // para escrever nem de fonte carregada.
  if (!destino) return null;

  // As fontes entram depois do primeiro paint, e capturar antes delas troca a
  // tipografia da figura pela de fallback — diferença que só aparece no PDF.
  await pagina.evaluate(() => document.fonts.ready);
  try {
    await unlink(destino);
  } catch {
    // não existia
  }
  await pagina.screenshot({ path: destino });

  const { size } = await stat(destino);
  if (size < BYTES_MINIMOS) {
    throw new Error(
      `${destino} saiu com ${size} bytes, abaixo do mínimo de ${BYTES_MINIMOS}. ` +
        "Captura quase vazia costuma ser rota ainda compilando.",
    );
  }
  return size;
}

function anunciar(tela, rota, bytes) {
  const nome = (tela.arquivo ?? "(sem figura)").padEnd(26);
  const medida = bytes === null ? "   abre" : `${String((bytes / 1024).toFixed(0)).padStart(5)} KB`;
  console.log(`${nome} ${medida}  ${rota}  — ${tela.descricao}`);
}

/** O arquivo de saida da tela, ou `null` quando nao ha o que salvar. */
function destinoDe(tela) {
  if (semSalvar || !tela.arquivo) return null;
  return join(saida, tela.arquivo);
}

const navegador = await chromium.launch();
try {
  if (!(await responde(base))) {
    console.error(`a web não respondeu em ${base}.\nSuba com: pnpm --filter @rally/web dev`);
    process.exit(1);
  }

  // A API só é exigida quando há tela atrás de login: cobrá-la sempre faria
  // `--sem-login` depender de um serviço que ele não usa.
  const precisaDaApi = TELAS.some((t) => t.login) && !somenteSemLogin;
  if (precisaDaApi && !(await responde(`${api}/health`))) {
    console.error(
      `a API não respondeu em ${api}/health.\n` +
        "Suba com: pnpm --filter @rally/api dev — e confira a DATABASE_URL.",
    );
    process.exit(1);
  }

  // `deviceScaleFactor: 2` é o que mantém a figura nítida quando o PDF a
  // reduz à largura da mancha; em 1x o texto da captura sai serrilhado.
  const publicas = await navegador.newContext({ deviceScaleFactor: 2 });
  const semSessao = await publicas.newPage();
  for (const tela of TELAS.filter((t) => !t.login)) {
    const destino = destinoDe(tela);
    anunciar(tela, tela.rota, await capturar(semSessao, tela, base + tela.rota, destino));
  }
  await publicas.close();

  const comLogin = TELAS.filter((t) => t.login);
  if (somenteSemLogin) {
    for (const tela of comLogin) {
      const nome = (tela.arquivo ?? "(sem figura)").padEnd(26);
      console.log(`${nome} PULADA — ${tela.rota} precisa de login`);
    }
  } else if (comLogin.length) {
    // Sessão separada, e não a mesma de cima: com cookie, `/entrar` e
    // `/recuperar-senha` redirecionam para o painel.
    const {
      contexto: privadas,
      pagina,
      id,
      reaproveitada,
    } = await contextoAutenticado(navegador, base, email, senha, { deviceScaleFactor: 2 });
    const quem = reaproveitada ? "sessão reaproveitada" : `autenticado como ${email}`;
    console.log(`\n${quem}, estabelecimento ${id}\n`);

    for (const tela of comLogin) {
      const rota = tela.rota.replace(":id", id);
      const destino = destinoDe(tela);
      anunciar(tela, rota, await capturar(pagina, tela, base + rota, destino));
    }
    await privadas.close();
  }
} finally {
  await navegador.close();
}
