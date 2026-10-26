// SPDX-License-Identifier: AGPL-3.0-or-later
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AppModule } from "../app.module";
import { LIMITES } from "./auth/limites";

/**
 * **Cada rota da API tem uma porta, e a porta está declarada.**
 *
 * Os portões que existiam até aqui olhavam uma família de rota cada:
 * `toda-escrita-auditada` e `toda-rota-escopada` cobrem a gestão, e
 * `identidade-do-token` cobre as rotas "dos meus dados". Nenhum deles
 * responde a pergunta mais simples: **existe rota sem porta?**
 *
 * Ela importa porque a resposta certa não é "nenhuma". Seis rotas são
 * abertas de propósito — a vitrine de quadras, o destaque de promoção e a
 * saúde — e é justamente por isso que o portão não pode ser "toda rota tem
 * guarda". Sem lista declarada, a única forma de saber se uma rota aberta é
 * decisão ou descuido é perguntar a quem a escreveu.
 *
 * Então a lista é a afirmação: **toda rota da aplicação está classificada
 * numa das cinco famílias abaixo**, e rota nova fica de fora de todas até que
 * alguém a classifique — o que reprova aqui, no lugar onde a pergunta cabe.
 *
 * A varredura sai do `AppModule`, descendo pelos `imports`: a fonte é a mesma
 * que o Nest usa para registrar as rotas, de modo que módulo novo entra no
 * portão no instante em que entra na aplicação. É a lição de 17/10, quando a
 * lista escrita à mão do portão de auditoria não via o
 * `RecorrenciasController` porque ninguém o acrescentou.
 *
 * **O que este portão não faz.** Ele lê metadado: vê que a rota recebe
 * `@CurrentUser()` e não vê o que o serviço faz com o DTO. `@Body()` sem
 * argumento entrega o objeto inteiro, e se o serviço ler `dto.usuarioId` em
 * vez do `sub` do token, nenhum metadado denuncia. Essa metade é do
 * `identidade-do-token`, que executa cada manipulador com um corpo
 * contaminado. Os dois são necessários, e o último teste daqui amarra um ao
 * outro.
 */

const DE_CORPO = 3;
const DE_CONSULTA = 4;
// O `5` (parâmetro de rota) não aparece aqui de propósito: quem confere que a
// arena vem do `@Param` é o `toda-rota-escopada`, que vai fundo na gestão.

/** O `@CurrentUser()` é o único decorador de parâmetro próprio em uso. */
const E_CUSTOM = /custom/i;

type Classe = { name: string; prototype: object };

type Rota = {
  nome: string;
  controlador: string;
  metodo: string;
  verbo: RequestMethod;
  caminho: string;
  guardas: string[];
  /** `[origem, nome]` de cada argumento do manipulador. */
  argumentos: [number | "custom", string | undefined][];
  /** O próprio manipulador, para ler metadado que não cabe nos campos acima. */
  alvo: unknown;
};

function modulosDaAplicacao(raiz: unknown, vistos = new Set<unknown>()): unknown[] {
  if (vistos.has(raiz)) return [];
  vistos.add(raiz);
  const fora = [raiz];
  const importados = (Reflect.getMetadata("imports", raiz as never) ?? []) as unknown[];
  for (const bruto of importados) {
    // Módulo dinâmico (`forRoot`) vem embrulhado em `{ module, providers }`.
    const alvo = (bruto as { module?: unknown }).module ?? bruto;
    if (typeof alvo === "function") fora.push(...modulosDaAplicacao(alvo, vistos));
  }
  return fora;
}

function rotas(): Rota[] {
  const achadas: Rota[] = [];
  for (const modulo of modulosDaAplicacao(AppModule)) {
    const controladores = (Reflect.getMetadata("controllers", modulo as never) ?? []) as Classe[];
    for (const controlador of controladores) {
      const prefixo = String(Reflect.getMetadata(PATH_METADATA, controlador) ?? "");
      const doControlador = (Reflect.getMetadata("__guards__", controlador) ?? []) as Classe[];
      const proto = controlador.prototype as unknown as Record<string, unknown>;

      for (const metodo of Object.getOwnPropertyNames(proto)) {
        if (metodo === "constructor") continue;
        const alvo = proto[metodo];
        if (typeof alvo !== "function") continue;
        const verbo = Reflect.getMetadata(METHOD_METADATA, alvo) as RequestMethod | undefined;
        if (verbo === undefined) continue;

        // Guarda de rota **somado** ao do controlador: o Nest avalia os dois,
        // e olhar só um dos níveis diria que a gestão não tem guarda nenhum.
        const daRota = (Reflect.getMetadata("__guards__", alvo) ?? []) as Classe[];
        const crus = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controlador, metodo) ??
          {}) as Record<string, { data?: unknown }>;

        achadas.push({
          nome: `${controlador.name}.${metodo}`,
          controlador: controlador.name,
          metodo,
          verbo,
          alvo,
          caminho: `${prefixo}/${String(Reflect.getMetadata(PATH_METADATA, alvo) ?? "")}`.replace(
            /\/+$/,
            "",
          ),
          guardas: [...doControlador, ...daRota].map((g) => g.name),
          argumentos: Object.entries(crus).map(([chave, valor]) => {
            const origem = chave.split(":")[0];
            return [
              E_CUSTOM.test(origem) ? "custom" : Number(origem),
              typeof valor.data === "string" ? valor.data : undefined,
            ];
          }),
        });
      }
    }
  }
  return achadas;
}

/**
 * As cinco famílias, e o que cada uma promete.
 *
 * A lista é escrita à mão porque **é a declaração** — o valor dela está em
 * alguém ter decidido. O que não é escrito à mão é a conferência: as rotas
 * vêm do `AppModule`, e o primeiro teste cobra que as duas listas fechem nos
 * dois sentidos.
 */
const FAMILIAS = {
  /** Painel: o papel é lido **dentro** do estabelecimento da URL (ADR-0011). */
  arena: [
    "AgendaController.criarBloqueio",
    "AgendaController.doDia",
    "AgendaController.moverReserva",
    "AgendaController.removerBloqueio",
    "AuditoriaController.listar",
    "ConciliacaoController.expirar",
    "ConciliacaoController.relatorio",
    "CuponsController.atualizar",
    "CuponsController.criar",
    "CuponsController.listar",
    "EquipeController.adicionar",
    "EquipeController.listar",
    "EquipeController.remover",
    "EquipeController.trocarPapel",
    "PainelController.resumo",
    "QuadrasGestaoController.atualizar",
    "QuadrasGestaoController.criar",
    "QuadrasGestaoController.detalhe",
    "QuadrasGestaoController.listar",
    "RecorrenciasController.criar",
    "RecorrenciasController.editar",
    "RecorrenciasController.encerrar",
    "RecorrenciasController.listar",
    "RecorrenciasController.materializar",
    "RelatoriosController.csv",
    "RelatoriosController.pdf",
    "RelatoriosController.relatorio",
    "RelatoriosController.xlsx",
  ],
  /** "Os meus dados": a identidade é o `sub` do token, nunca o do pedido. */
  minha: [
    "AuthController.me",
    "GestaoController.meusEstabelecimentos",
    "NotificacoesController.lerTodas",
    "NotificacoesController.marcarLida",
    "NotificacoesController.minhas",
    "PrivacidadeController.excluirConta",
    "PrivacidadeController.meusDados",
    "ReplaysController.meus",
    "ReservasController.cancelar",
    "ReservasController.criar",
    "ReservasController.detalhe",
    "ReservasController.minhas",
    "ReservasController.remarcar",
    "ReservasController.simularPagamento",
  ],
  /** Autenticação: sem sessão por definição, e por isso com limite (RNF-06). */
  credencial: [
    "AuthController.login",
    "AuthController.recuperarSenha",
    "AuthController.redefinirSenha",
    "AuthController.register",
    "AuthController.verificarEmail",
  ],
  /** Máquina a máquina: segredo compartilhado, comparado em tempo constante. */
  segredo: ["IngestaoDeReplaysController.ingestar", "PagamentosController.webhook"],
  /**
   * Abertas **de propósito**, com o motivo de cada uma:
   *
   * - A vitrine de quadras é o que o jogador vê antes de ter conta; exigir
   *   sessão para ver preço e horário livre mataria a função do produto.
   * - O destaque de promoção alimenta a mesma vitrine.
   * - A saúde é alvo de monitoramento, e o que ela expõe — nome de rota e
   *   tempo — já é dedutível por quem usa o aplicativo. O lugar dela é atrás
   *   do proxy quando houver um, e isso está escrito no controlador.
   */
  aberta: [
    "HealthController.check",
    "HealthController.latenciaPorRota",
    "PromocoesController.destaque",
    "QuadrasController.detalhe",
    "QuadrasController.disponibilidade",
    "QuadrasController.listar",
  ],
} as const;

type Familia = keyof typeof FAMILIAS;

const TODAS = rotas();

function de(familia: Familia): Rota[] {
  const nomes = new Set<string>(FAMILIAS[familia]);
  return TODAS.filter((r) => nomes.has(r.nome));
}

function pedeSessao(r: Rota): boolean {
  return r.guardas.includes("JwtAuthGuard");
}

/**
 * A rota está isenta de **todo** balde de limite.
 *
 * O `@SkipThrottle` grava **uma chave de metadado por balde**
 * (`THROTTLER:SKIP` mais o nome), e não um mapa — e é aí que mora a armadilha
 * de 23/10: `@SkipThrottle()` sem argumento isenta apenas um balde chamado
 * literalmente `default`, de modo que numa configuração com baldes nomeados
 * ele não isenta nada e a rota segue limitada por todos.
 *
 * Por isso a pergunta é feita balde a balde, com os nomes vindos do próprio
 * `LIMITES`: isenção de um só não torna a rota sem limite.
 */
const SKIP = "THROTTLER:SKIP";

function isento(r: Rota): boolean {
  const baldes = LIMITES.throttlers.map((t) => String(t.name));
  return (
    baldes.length > 0 &&
    baldes.every((nome) => Reflect.getMetadata(SKIP + nome, r.alvo as never) === true)
  );
}

describe("toda rota da API tem porta, e a porta está declarada", () => {
  it("a varredura acha as rotas de verdade, e desce pelos módulos", () => {
    // Sem esta âncora, um erro na leitura do metadado faria o portão passar
    // varrendo nada — e passaria a provar o contrário do que promete.
    expect(TODAS.length).toBeGreaterThan(40);
    // Mais de um módulo: um `imports` lido errado devolveria só o AppModule.
    expect(new Set(TODAS.map((r) => r.controlador)).size).toBeGreaterThan(10);
  });

  it("nenhuma rota fica fora das cinco famílias, e nenhuma família cita rota que não existe", () => {
    // **A afirmação central.** Rota nova sem classificação reprova aqui, que
    // é onde a pergunta "qual é a porta desta?" cabe.
    const declaradas = new Set<string>(Object.values(FAMILIAS).flat());
    const semFamilia = TODAS.map((r) => r.nome).filter((n) => !declaradas.has(n));
    expect(semFamilia).toEqual([]);

    const registradas = new Set(TODAS.map((r) => r.nome));
    const fantasmas = [...declaradas].filter((n) => !registradas.has(n));
    expect(fantasmas).toEqual([]);

    // E nenhuma rota em duas famílias: a soma tem de fechar com o total.
    const soma = Object.values(FAMILIAS).reduce((n, lista) => n + lista.length, 0);
    expect(soma).toBe(TODAS.length);
  });

  it("as rotas da arena pedem sessão e papel", () => {
    const faltando = de("arena")
      .filter((r) => !pedeSessao(r) || !r.guardas.includes("PapelGuard"))
      .map((r) => `${r.nome}: ${r.guardas.join(",") || "nenhum"}`);

    expect(faltando).toEqual([]);
  });

  it("as rotas dos meus dados pedem sessão e leem a identidade do token", () => {
    const semSessao = de("minha")
      .filter((r) => !pedeSessao(r))
      .map((r) => r.nome);
    expect(semSessao).toEqual([]);

    // `@CurrentUser()` é o único decorador de parâmetro próprio em uso, e é
    // ele que lê o `req.user` que o guarda pôs ali. Rota desta família sem
    // ele só poderia estar tirando a identidade do pedido.
    const semToken = de("minha")
      .filter((r) => !r.argumentos.some(([origem]) => origem === "custom"))
      .map((r) => r.nome);
    expect(semToken).toEqual([]);
  });

  it("nenhuma rota lê identificador de usuário do corpo ou da consulta", () => {
    // O corpo é texto do atacante. O caminho da URL também vem de fora, mas
    // ele endereça o recurso e passa pelo guarda — `DELETE /equipe/:usuarioId`
    // é o **alvo** da remoção, e quem a executa vem do token. Dizer quem se é
    // pelo corpo é outra coisa, e não acontece em rota nenhuma.
    const suspeitos = /^(usuarioId|clienteId|userId|sub)$/;
    const forjavel = TODAS.filter((r) =>
      r.argumentos.some(
        ([origem, nome]) =>
          (origem === DE_CORPO || origem === DE_CONSULTA) &&
          nome !== undefined &&
          suspeitos.test(nome),
      ),
    ).map((r) => r.nome);

    expect(forjavel).toEqual([]);
  });

  it("as rotas de credencial têm limite de tentativa, e são as únicas", () => {
    // **A extensão do limite fica escrita aqui.** O `app.module.ts` registra a
    // decisão — "o resto da API segue sem limite, que é o certo: a grade de
    // disponibilidade é consultada em rajada pela própria tela" — e sem este
    // teste a extensão dela era dedutível só lendo os dez controladores.
    //
    // Importa nos dois sentidos. Balde a menos numa rota de credencial abre
    // tentativa de senha em volume; balde a mais numa rota de leitura derruba
    // a tela, que foi o que aconteceu com o `/auth/me` em 23/10 — ele herdou
    // o balde da senha errada e caía a cada dez carregamentos por minuto.
    //
    // **Ter o guarda não é ter limite**, e esta asserção existe na forma que
    // está porque a primeira versão dela confundiu as duas coisas. O
    // `ThrottlerGuard` está no controlador inteiro, de modo que o `/auth/me`
    // também o carrega; o que o isenta é o `@SkipThrottle` em cima dele. Quem
    // decide é o metadado de isenção, não a presença do guarda.
    const semLimite = de("credencial")
      .filter((r) => !r.guardas.includes("ThrottlerGuard") || isento(r))
      .map((r) => r.nome);
    expect(semLimite).toEqual([]);

    const comLimiteForaDaFamilia = TODAS.filter(
      (r) =>
        r.guardas.includes("ThrottlerGuard") &&
        !isento(r) &&
        !(FAMILIAS.credencial as readonly string[]).includes(r.nome),
    ).map((r) => r.nome);
    expect(comLimiteForaDaFamilia).toEqual([]);

    // E a isenção não é curinga: ela existe numa rota só, a leitura da conta.
    const isentas = TODAS.filter(isento).map((r) => r.nome);
    expect(isentas).toEqual(["AuthController.me"]);
  });

  it("as rotas de máquina pedem segredo, e não sessão", () => {
    // Sessão não serve: quem chama é o provedor de pagamento e o parceiro de
    // captação, que não têm conta. O que serve é segredo compartilhado — e a
    // ausência do `JwtAuthGuard` aqui é tão deliberada quanto a presença dele
    // nas outras famílias.
    for (const r of de("segredo")) {
      expect(r.guardas.some((g) => /Segredo/.test(g))).toBe(true);
      expect(pedeSessao(r)).toBe(false);
    }
    expect(de("segredo")).toHaveLength(2);
  });

  it("as rotas abertas são só as declaradas, e nenhuma delas escreve", () => {
    const comGuarda = de("aberta")
      .filter((r) => r.guardas.length > 0)
      .map((r) => `${r.nome}: ${r.guardas.join(",")}`);
    // Guarda numa rota declarada aberta não é erro de segurança, é sinal de
    // que a declaração envelheceu — e declaração que não corresponde é pior
    // que declaração nenhuma, porque ninguém a relê.
    expect(comGuarda).toEqual([]);

    // **Nenhuma rota sem guarda escreve.** É o limite que torna a lista
    // aceitável: leitura aberta é escolha de produto, escrita aberta não é
    // escolha nenhuma.
    const escrevemSemPorta = TODAS.filter(
      (r) => r.guardas.length === 0 && r.verbo !== RequestMethod.GET,
    ).map((r) => `${r.nome} (${RequestMethod[r.verbo]})`);
    expect(escrevemSemPorta).toEqual([]);
  });

  it("toda rota dos meus dados é exercitada pelo portão de identidade", () => {
    // **A âncora que amarra os dois portões.** Este lê metadado e não vê o
    // que o serviço faz com o DTO; o `identidade-do-token` executa cada
    // manipulador com um corpo contaminado e vê. A suíte dele é escrita à
    // mão — a docstring dela diz "os cinco controladores do cliente" —, e
    // lista à mão envelhece calada.
    //
    // A conferência é por menção, não por execução: ela prova que a rota
    // **entrou** na suíte, e as asserções de lá provam o que ela faz. É
    // alimentação com portão, que é o que faltou em 17/10.
    const fonte = readFileSync(join(__dirname, "identidade-do-token.spec.ts"), "utf-8");

    const foraDaSuite = de("minha")
      .filter((r) => !fonte.includes(`.${r.metodo}(`))
      .map((r) => r.nome);

    expect(foraDaSuite).toEqual([]);
  });
});
