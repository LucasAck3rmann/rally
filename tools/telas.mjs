// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * As telas do sistema, e o percurso até elas.
 *
 * **Uma lista só, e por isso ela mora aqui.** Quatro consumidores já a usam —
 * `capturas.mjs`, que fotografa as que o Relatório ilustra,
 * `alvos-de-toque.mjs`, que mede o controle renderizado em todas,
 * `contraste.mjs`, que mede a cor de todo texto desenhado nelas, e
 * `nome-acessivel.mjs`, que cobra nome de todo controle delas. Listas
 * separadas divergiriam, e a que não fosse exercitada quebraria calada; é o
 * mesmo argumento que o script de captura sempre fez a respeito do
 * navegador, aplicado à lista de rotas.
 *
 * `arquivo` ausente significa **tela que o portão abre e a figura não usa**:
 * o Relatório ilustra sete, e o painel tem nove rotas. Deixar as outras fora
 * desta lista seria deixá-las sem ninguém abrindo — foi assim que cupons,
 * quadras, equipe e conciliação passaram semanas quebradas sem que nada
 * reclamasse.
 *
 * `:id` é substituído pelo estabelecimento que o login alcançar.
 */

/** Largura de desktop estreita o bastante para o texto seguir legível quando a figura é reduzida à largura da mancha. */
export const LARGURA = 1280;

export const TELAS = [
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

/** Valor de `--nome` na linha de comando, ou o padrão. */
export function argumento(nome, padrao) {
  const i = process.argv.indexOf(`--${nome}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

/** Espera um endereço responder: sem isto o trabalho começa antes do servidor. */
export async function responde(url, tentativas = 30) {
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

/**
 * Entra no painel e devolve o id do estabelecimento alcançado.
 *
 * O id **não é fixado**: `/gestao` redireciona para o primeiro
 * estabelecimento do usuário, e ler a URL resultante mantém o percurso
 * funcionando quando o seed mudar de identificador.
 *
 * As credenciais vêm do `prisma/seed.ts`, que é onde são declaradas.
 *
 * **A falha diz por quê.** O login da API é limitado a dez tentativas por
 * minuto (`@Throttle` no `auth.controller.ts`), e cada ferramenta que usa
 * este percurso gasta uma. Quando o balde esvazia, o formulário recebe a
 * recusa e **não navega**: o `waitForURL` estoura, e o erro que sai de
 * fábrica fala de navegação, não de limitador. Perder meia hora atrás de um
 * "timeout de navegação" que era 429 é fácil, e aconteceu — por isso a recusa
 * que a tela mostra entra na mensagem.
 */
export async function entrar(pagina, base, email, senha) {
  await pagina.goto(`${base}/entrar`, { waitUntil: "networkidle" });
  await pagina.fill('input[name="email"]', email);
  await pagina.fill('input[name="senha"]', senha);
  try {
    await Promise.all([
      pagina.waitForURL(/\/gestao\//, { timeout: 30_000 }),
      pagina.click('button[type="submit"]'),
    ]);
  } catch (erro) {
    const recusa = await pagina
      .locator('[role="alert"]')
      .first()
      .textContent({ timeout: 2_000 })
      .catch(() => null);
    throw new Error(
      `o login não saiu de ${pagina.url()}.\n` +
        (recusa
          ? `A tela respondeu: "${recusa.trim()}"\n` +
            "Se foi excesso de tentativas, é o limitador: o login aceita dez " +
            "por minuto, e cada ferramenta que faz este percurso gasta uma. " +
            "Espere um minuto e repita.\n"
          : "A tela não mostrou recusa; confira se a API responde e se o seed rodou.\n") +
        `Causa original: ${erro.message.split("\n")[0]}`,
    );
  }

  const achado = new URL(pagina.url()).pathname.match(/^\/gestao\/([^/]+)/);
  if (!achado) {
    throw new Error(
      `o login não chegou a /gestao/:id — parou em ${pagina.url()}.\n` +
        "Confira se a API responde e se o seed rodou.",
    );
  }
  return achado[1];
}

/**
 * Onde a sessão compartilhada entre as ferramentas é guardada.
 *
 * **Fora do repositório, de propósito.** O arquivo guarda o cookie de sessão,
 * e cookie de sessão não entra em histórico nem por acidente — por isso ele
 * mora no diretório temporário do sistema, e não numa pasta de trabalho onde
 * um `git add` distraído o alcançaria. A sessão é de um servidor local, com
 * as credenciais de demonstração do `seed.ts`, e na CI morre com o job.
 */
const SESSAO = join(tmpdir(), "rally-sessao-dos-portoes.json");

/**
 * Devolve um contexto já autenticado, reaproveitando a sessão quando dá.
 *
 * **Por que compartilhar.** O login da API aceita dez tentativas por minuto,
 * e cada ferramenta que fazia o percurso gastava uma. Com quatro portões o
 * número já era quatro, e cada medida nova estreitava a folga de um limite
 * que existe para proteger a aplicação, não para ser contornado. Logar uma
 * vez e reusar o cookie mantém a proteção intacta e tira o acoplamento: a
 * conta de logins deixa de crescer com a quantidade de medidas.
 *
 * **A sessão reaproveitada é conferida, não presumida.** Cookie vencido ou de
 * outro servidor levaria a ferramenta a medir a tela de entrada achando que
 * mede o painel — exatamente o defeito que o `espera` de cada tela existe
 * para impedir. Por isso o contexto recuperado navega até `/gestao` e só vale
 * se chegar a `/gestao/:id`; se não chegar, ele é descartado e o login é
 * refeito do zero.
 */
export async function contextoAutenticado(navegador, base, email, senha, opcoes = {}) {
  if (existsSync(SESSAO)) {
    const contexto = await navegador.newContext({ ...opcoes, storageState: SESSAO });
    const pagina = await contexto.newPage();
    try {
      await pagina.goto(`${base}/gestao`, { waitUntil: "networkidle", timeout: 20_000 });
      const achado = new URL(pagina.url()).pathname.match(/^\/gestao\/([^/]+)/);
      if (achado) return { contexto, pagina, id: achado[1], reaproveitada: true };
    } catch {
      // sessão inutilizável; o descarte abaixo trata
    }
    await contexto.close();
  }

  const contexto = await navegador.newContext(opcoes);
  const pagina = await contexto.newPage();
  const id = await entrar(pagina, base, email, senha);
  await contexto.storageState({ path: SESSAO });
  return { contexto, pagina, id, reaproveitada: false };
}

/**
 * Abre a tela e cobra que o título esperado apareça.
 *
 * **O título é a prova de que a tela é a que se pediu.** Redirecionamento
 * silencioso leva a outra página, e tudo o que vier depois — foto ou
 * medição — descreve a página errada com perfeição.
 */
export async function abrir(pagina, tela, url) {
  await pagina.setViewportSize({ width: LARGURA, height: tela.altura });
  await pagina.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
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
}
