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

/** Largura de desktop estreita o bastante para o texto seguir legível quando a figura é reduzida à largura da mancha. */
const LARGURA = 1280;

/**
 * Abaixo disto a captura é tratada como falha.
 *
 * Pega página ainda compilando, que sai **em branco**: um PNG branco de
 * 1280 px não dá erro, vira figura vazia no PDF e ninguém vê até a defesa.
 * Não pega página errada — para isso serve o `espera` de cada tela.
 */
const BYTES_MINIMOS = 8 * 1024;

/** `:id` é substituído pelo estabelecimento que o login alcançar. */
const TELAS = [
  { arquivo: "fig7-landing.png", rota: "/", altura: 1500, login: false, espera: "Do agendamento ao replay", descricao: "página inicial pública" },
  { arquivo: "fig8-entrar.png", rota: "/entrar", altura: 900, login: false, espera: "Entrar no painel", descricao: "entrada no painel de gestão" },
  { arquivo: "fig9-recuperar-senha.png", rota: "/recuperar-senha", altura: 820, login: false, espera: "Esqueceu a senha?", descricao: "recuperação de senha" },
  { arquivo: "fig10-painel.png", rota: "/gestao/:id", altura: 1400, login: true, espera: "Painel", descricao: "painel do dono, com ocupação e receita" },
  { arquivo: "fig11-agenda.png", rota: "/gestao/:id/agenda", altura: 1300, login: true, espera: "Agenda", descricao: "agenda do dia, com bloqueio de horário" },
  { arquivo: "fig12-mensalistas.png", rota: "/gestao/:id/mensalistas", altura: 1200, login: true, espera: "Mensalistas", descricao: "mensalistas, com a folga do horizonte (RF-36)" },
  { arquivo: "fig13-trilha.png", rota: "/gestao/:id/auditoria", altura: 1200, login: true, espera: "Trilha de auditoria", descricao: "trilha de auditoria (RN-05)" },
];

function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const saida = resolve(argumento("saida", "figuras"));
// Credenciais do `prisma/seed.ts`, que é onde elas são declaradas: repetir o
// valor aqui criaria a segunda cópia de uma verdade.
const email = argumento("email", "dono@arena.com");
const senha = argumento("senha", "rally123");
const somenteSemLogin = process.argv.includes("--sem-login");

/** Espera a web responder: sem isto a captura sai em branco se o Next ainda compila. */
async function dePe(tentativas = 20) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(3000) });
      if (r.status < 500) return true;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function capturar(pagina, tela, url, destino) {
  await mkdir(dirname(destino), { recursive: true });
  await pagina.setViewportSize({ width: LARGURA, height: tela.altura });
  await pagina.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

  // **O título é a prova de que a tela é a que se pediu.** Redirecionamento
  // silencioso leva a outra página e o PNG sai perfeito — da página errada.
  try {
    await pagina
      .getByRole("heading", { name: tela.espera, exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    throw new Error(
      `${tela.arquivo}: não achei o título "${tela.espera}" em ${pagina.url()}.\n` +
        "A navegação terminou noutra tela, ou o título mudou e esta lista não acompanhou.",
    );
  }

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
  const kb = String((bytes / 1024).toFixed(0)).padStart(5);
  console.log(`${tela.arquivo.padEnd(26)} ${kb} KB  ${rota}  — ${tela.descricao}`);
}

/**
 * Entra no painel e devolve o id do estabelecimento alcançado.
 *
 * O id **não é fixado**: `/gestao` redireciona para o primeiro
 * estabelecimento do usuário, e ler a URL resultante mantém o script
 * funcionando quando o seed mudar de identificador.
 */
async function entrar(pagina) {
  await pagina.goto(`${base}/entrar`, { waitUntil: "networkidle" });
  await pagina.fill('input[name="email"]', email);
  await pagina.fill('input[name="senha"]', senha);
  await Promise.all([
    pagina.waitForURL(/\/gestao\//, { timeout: 30_000 }),
    pagina.click('button[type="submit"]'),
  ]);

  const achado = new URL(pagina.url()).pathname.match(/^\/gestao\/([^/]+)/);
  if (!achado) {
    throw new Error(
      `o login não chegou a /gestao/:id — parou em ${pagina.url()}.\n` +
        "Confira se a API responde e se o seed rodou.",
    );
  }
  return achado[1];
}

const navegador = await chromium.launch();
try {
  if (!(await dePe())) {
    console.error(
      `a web não respondeu em ${base}.\nSuba com: pnpm --filter @rally/web dev`,
    );
    process.exit(1);
  }

  // `deviceScaleFactor: 2` é o que mantém a figura nítida quando o PDF a
  // reduz à largura da mancha; em 1x o texto da captura sai serrilhado.
  const publicas = await navegador.newContext({ deviceScaleFactor: 2 });
  const semSessao = await publicas.newPage();
  for (const tela of TELAS.filter((t) => !t.login)) {
    const destino = join(saida, tela.arquivo);
    anunciar(tela, tela.rota, await capturar(semSessao, tela, base + tela.rota, destino));
  }
  await publicas.close();

  const comLogin = TELAS.filter((t) => t.login);
  if (somenteSemLogin) {
    for (const tela of comLogin) {
      console.log(`${tela.arquivo.padEnd(26)} PULADA — precisa de login`);
    }
  } else if (comLogin.length) {
    // Sessão separada, e não a mesma de cima: com cookie, `/entrar` e
    // `/recuperar-senha` redirecionam para o painel.
    const privadas = await navegador.newContext({ deviceScaleFactor: 2 });
    const pagina = await privadas.newPage();
    const id = await entrar(pagina);
    console.log(`\nautenticado como ${email}, estabelecimento ${id}\n`);

    for (const tela of comLogin) {
      const rota = tela.rota.replace(":id", id);
      const destino = join(saida, tela.arquivo);
      anunciar(tela, rota, await capturar(pagina, tela, base + rota, destino));
    }
    await privadas.close();
  }
} finally {
  await navegador.close();
}
