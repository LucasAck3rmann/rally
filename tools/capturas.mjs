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

/**
 * As telas do sistema.
 *
 * `arquivo` ausente significa **tela que o portão abre e a figura não usa**:
 * o Relatório ilustra sete, e o painel tem nove rotas. Deixar as outras fora
 * desta lista seria deixá-las sem ninguém abrindo — foi assim que cupons,
 * quadras, equipe e conciliação passaram semanas quebradas sem que nada
 * reclamasse.
 *
 * `:id` é substituído pelo estabelecimento que o login alcançar.
 */
const TELAS = [
  { arquivo: "fig7-landing.png", rota: "/", altura: 1500, login: false, espera: "Do agendamento ao replay", descricao: "página inicial pública" },
  { arquivo: "fig8-entrar.png", rota: "/entrar", altura: 900, login: false, espera: "Entrar no painel", descricao: "entrada no painel de gestão" },
  { arquivo: "fig9-recuperar-senha.png", rota: "/recuperar-senha", altura: 820, login: false, espera: "Esqueceu a senha?", descricao: "recuperação de senha" },
  { arquivo: "fig10-painel.png", rota: "/gestao/:id", altura: 1400, login: true, espera: "Painel", descricao: "painel do dono, com ocupação e receita" },
  { arquivo: "fig11-agenda.png", rota: "/gestao/:id/agenda", altura: 1300, login: true, espera: "Agenda", descricao: "agenda do dia, com bloqueio de horário" },
  { arquivo: "fig12-mensalistas.png", rota: "/gestao/:id/mensalistas", altura: 1200, login: true, espera: "Mensalistas", descricao: "mensalistas, com a folga do horizonte (RF-36)" },
  { arquivo: "fig13-trilha.png", rota: "/gestao/:id/auditoria", altura: 1200, login: true, espera: "Trilha de auditoria", descricao: "trilha de auditoria (RN-05)" },
  // Sem figura no Relatório, mas dentro do portão: são rotas do painel, e
  // quatro delas estavam entre as seis que não renderizavam.
  { rota: "/gestao/:id/quadras", altura: 1200, login: true, espera: "Quadras", descricao: "cadastro de quadras e preços" },
  { rota: "/gestao/:id/relatorios", altura: 1200, login: true, espera: "Relatórios", descricao: "relatório do período" },
  { rota: "/gestao/:id/cupons", altura: 1100, login: true, espera: "Cupons", descricao: "promoções e cupons" },
  { rota: "/gestao/:id/conciliacao", altura: 1100, login: true, espera: "Conciliação", descricao: "conciliação de pagamentos" },
  { rota: "/gestao/:id/equipe", altura: 1100, login: true, espera: "Equipe", descricao: "usuários e permissões" },
  { rota: "/gestao/privacidade", altura: 1100, login: true, espera: "Privacidade", descricao: "direitos do titular (LGPD)" },
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
// A API nao e desenhada aqui, mas o login depende dela. Na CI os dois
// servidores sobem em paralelo e o portao corre logo atras: sem esperar,
// falharia **as vezes** -- a pior frequencia possivel, rara o bastante para
// virar "instabilidade" e ser reexecutada sem olhar.
const api = (argumento("api", process.env.API_URL ?? "http://localhost:3333/api/v1"))
  .replace(/\/$/, "");
// **Modo portão:** abre cada tela e cobra o título, sem salvar arquivo. É o
// mesmo percurso da captura, porque a lista de telas tem de ser uma só — e
// serve à CI, que não quer as imagens e quer a garantia.
const semSalvar = process.argv.includes("--sem-salvar");

/** Espera a web responder: sem isto a captura sai em branco se o Next ainda compila. */
async function responde(url, tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.status < 500) return true;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Abre a tela, cobra o titulo e -- quando ha arquivo -- fotografa. */
async function capturar(pagina, tela, url, destino) {
  if (destino) await mkdir(dirname(destino), { recursive: true });
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
      `${tela.rota}: não achei o título "${tela.espera}" em ${pagina.url()}.\n` +
        "A navegação terminou noutra tela, ou o título mudou e esta lista não acompanhou.",
    );
  }

  // As fontes entram depois do primeiro paint, e capturar antes delas troca a
  // tipografia da figura pela de fallback — diferença que só aparece no PDF.
  // Sem arquivo a salvar o trabalho acaba aqui: o portao queria o titulo,
  // e ele apareceu. E o que a CI roda, e por isso ela nao precisa de disco
  // para escrever nem de fonte carregada.
  if (!destino) return null;

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
  const medida =
    bytes === null ? "   abre" : `${String((bytes / 1024).toFixed(0)).padStart(5)} KB`;
  console.log(`${nome} ${medida}  ${rota}  — ${tela.descricao}`);
}

/** O arquivo de saida da tela, ou `null` quando nao ha o que salvar. */
function destinoDe(tela) {
  if (semSalvar || !tela.arquivo) return null;
  return join(saida, tela.arquivo);
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
  if (!(await responde(base))) {
    console.error(
      `a web não respondeu em ${base}.\nSuba com: pnpm --filter @rally/web dev`,
    );
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
    const privadas = await navegador.newContext({ deviceScaleFactor: 2 });
    const pagina = await privadas.newPage();
    const id = await entrar(pagina);
    console.log(`\nautenticado como ${email}, estabelecimento ${id}\n`);

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
