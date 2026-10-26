// SPDX-License-Identifier: AGPL-3.0-or-later
import { ExecutionContext, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of, throwError } from "rxjs";

import { PrismaService } from "../../prisma/prisma.service";
import { Auditar } from "./auditar.decorator";
import { AuditoriaInterceptor } from "./auditoria.interceptor";
import { AuditoriaService } from "./auditoria.service";

/**
 * **A trilha de auditoria (RN-05).**
 *
 * A RN-05 pede que ações sensíveis sejam auditadas, e a entidade `AuditLog`
 * existia no esquema desde junho **sem que nada escrevesse nela**. Pior que a
 * lacuna: a §5.1 do relatório afirmava, no presente, que *"a trilha de
 * auditoria registra quem executou cada ação sensível"* — uma capacidade
 * atribuída a um campo vazio.
 *
 * As três decisões que esta suíte prende:
 *
 * 1. **Só grava quando a ação deu certo.** Uma tentativa recusada não é uma
 *    ação executada, e registrá-la encheria a trilha de linhas que o dono
 *    leria como "alguém fez isso".
 * 2. **O autor vem do token**, nunca do corpo. Lê-lo do corpo permitiria
 *    assinar a ação com o nome de outra pessoa — o oposto do que a trilha
 *    serve.
 * 3. **Campo sensível não entra.** A trilha é lida pelo dono da arena, e
 *    guardar senha ou e-mail de terceiro transformaria governança em
 *    vazamento.
 */

function contexto({
  params = { estabelecimentoId: "e1" },
  user = { sub: "u1", email: "dono@arena.com" },
  body = undefined as unknown,
  tipo = "http",
  semSessao = false,
}: {
  params?: Record<string, string>;
  user?: { sub: string; email: string };
  body?: unknown;
  tipo?: string;
  /**
   * Um sinalizador, e nao `user: undefined`: num destructuring com valor
   * padrao, passar `undefined` **aciona o padrao** — de modo que nao da para
   * distinguir "nao passei" de "passei vazio". Foi o que fez este teste
   * reprovar na primeira escrita.
   */
  semSessao?: boolean;
} = {}): ExecutionContext {
  return {
    getType: () => tipo,
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ params, user: semSessao ? undefined : user, body }),
    }),
  } as unknown as ExecutionContext;
}

function montar(descricao: unknown) {
  const create = jest.fn().mockResolvedValue({ id: "a1" });
  const prisma = { auditLog: { create } } as unknown as PrismaService;
  const servico = new AuditoriaService(prisma);
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(descricao),
  } as unknown as Reflector;
  return { interceptor: new AuditoriaInterceptor(reflector, servico), create };
}

const ACAO = { acao: "pausar quadra", entidade: "Quadra", parametro: "quadraId" };

/** Espera o microtask em que o interceptor dispara a gravação. */
const assentar = () => new Promise((r) => setImmediate(r));

describe("AuditoriaInterceptor (RN-05)", () => {
  it("grava a ação, o autor e a entidade afetada", async () => {
    const { interceptor, create } = montar(ACAO);
    const ctx = contexto({ params: { estabelecimentoId: "e1", quadraId: "q7" } });

    interceptor.intercept(ctx, { handle: () => of({ ok: true }) }).subscribe();
    await assentar();

    expect(create).toHaveBeenCalledWith({
      data: {
        estabelecimentoId: "e1",
        autorId: "u1",
        acao: "pausar quadra",
        entidade: "Quadra",
        entidadeId: "q7",
        dados: undefined,
      },
    });
  });

  it("rota sem o decorador não é auditada", async () => {
    // É o que mantém a trilha confiável: ela tem o que foi marcado como
    // sensível, e não tudo o que passou pela API.
    const { interceptor, create } = montar(undefined);

    interceptor.intercept(contexto(), { handle: () => of({}) }).subscribe();
    await assentar();

    expect(create).not.toHaveBeenCalled();
  });

  it("ação recusada não entra na trilha", async () => {
    // **A asserção que mais importa.** Um 403 do `PapelGuard` ou um 409 da
    // regra do último administrador são ações que **não aconteceram**.
    const { interceptor, create } = montar(ACAO);

    interceptor
      .intercept(contexto(), { handle: () => throwError(() => new Error("403")) })
      .subscribe({ error: () => undefined });
    await assentar();

    expect(create).not.toHaveBeenCalled();
  });

  it("o autor vem do token, e um `autorId` no corpo é ignorado", async () => {
    const { interceptor, create } = montar({ acao: "editar", entidade: "Quadra" });
    const ctx = contexto({
      user: { sub: "u-do-token", email: "x@y.com" },
      body: { autorId: "u-outra-pessoa", nome: "Quadra 1" },
    });

    interceptor.intercept(ctx, { handle: () => of({}) }).subscribe();
    await assentar();

    const { data } = create.mock.calls[0][0];
    expect(data.autorId).toBe("u-do-token");
    // O campo do corpo vai como dado da ação, não como autoria.
    expect(data.dados).toEqual({ autorId: "u-outra-pessoa", nome: "Quadra 1" });
  });

  it("sem sessão, o autor fica nulo em vez de a linha sumir", async () => {
    // Ação de sistema (um job, por exemplo) ainda precisa aparecer na trilha.
    const { interceptor, create } = montar({ acao: "expirar", entidade: "Pagamento" });

    interceptor.intercept(contexto({ semSessao: true }), { handle: () => of({}) }).subscribe();
    await assentar();

    expect(create.mock.calls[0][0].data.autorId).toBeNull();
  });

  it("campos sensíveis não entram na trilha", async () => {
    // A trilha é lida pelo dono da arena. Senha nem deveria passar aqui, e o
    // e-mail de um convite é dado pessoal de terceiro que a RN-05 não pede.
    const { interceptor, create } = montar({ acao: "convidar", entidade: "Membership" });
    const ctx = contexto({
      body: {
        email: "pessoa@exemplo.com",
        senha: "segredo",
        token: "tok",
        pixCopiaCola: "00020126",
        papel: "ATENDENTE",
      },
    });

    interceptor.intercept(ctx, { handle: () => of({}) }).subscribe();
    await assentar();

    const { dados } = create.mock.calls[0][0].data;
    expect(dados).toEqual({ papel: "ATENDENTE" });
    expect(JSON.stringify(dados)).not.toContain("segredo");
    expect(JSON.stringify(dados)).not.toContain("pessoa@exemplo.com");
  });

  it("corpo que fica vazio depois da limpeza não grava objeto vazio", async () => {
    const { interceptor, create } = montar({ acao: "x", entidade: "Y" });

    interceptor
      .intercept(contexto({ body: { senha: "só isso" } }), { handle: () => of({}) })
      .subscribe();
    await assentar();

    expect(create.mock.calls[0][0].data.dados).toBeUndefined();
  });

  it("sem estabelecimento na rota, não há trilha", async () => {
    // O `AuditLog` é por inquilino: linha sem estabelecimento não teria onde
    // aparecer, e inventar um seria pior que não registrar.
    const { interceptor, create } = montar(ACAO);

    interceptor.intercept(contexto({ params: {} }), { handle: () => of({}) }).subscribe();
    await assentar();

    expect(create).not.toHaveBeenCalled();
  });

  it("entidadeId fica nulo quando a rota não tem o parâmetro", async () => {
    const { interceptor, create } = montar({ acao: "criar", entidade: "Promocao" });

    interceptor.intercept(contexto(), { handle: () => of({}) }).subscribe();
    await assentar();

    expect(create.mock.calls[0][0].data.entidadeId).toBeNull();
  });

  it("não intercepta o que não é HTTP", async () => {
    const { interceptor, create } = montar(ACAO);

    interceptor.intercept(contexto({ tipo: "rpc" }), { handle: () => of({}) }).subscribe();
    await assentar();

    expect(create).not.toHaveBeenCalled();
  });
});

describe("AuditoriaService", () => {
  it("falha ao gravar não derruba a operação, e fica no log", async () => {
    // A trilha é escrita **depois** da ação. Propagar o erro aqui recusaria o
    // cancelamento de uma reserva porque a linha de auditoria não gravou —
    // transformaria um problema de registro num problema de operação, e quem
    // está no balcão com o cliente na frente não tem como resolver isso.
    const erro = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const create = jest.fn().mockRejectedValue(new Error("conexão caiu"));
    const servico = new AuditoriaService({
      auditLog: { create },
    } as unknown as PrismaService);

    await expect(
      servico.registrar({
        estabelecimentoId: "e1",
        autorId: "u1",
        acao: "pausar quadra",
        entidade: "Quadra",
        entidadeId: "q1",
      }),
    ).resolves.toBeUndefined();

    // O buraco na trilha não é silencioso.
    expect(erro).toHaveBeenCalledWith(
      expect.stringContaining("Falha ao registrar na trilha"),
      // A pilha vai junto: o buraco na trilha nao e silencioso, e sem ela o
      // log diria que falhou sem dizer onde.
      expect.any(String),
    );
    erro.mockRestore();
  });

  it("lista do mais recente para o mais antigo, com teto", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const servico = new AuditoriaService({
      auditLog: { findMany },
    } as unknown as PrismaService);

    await servico.listar("e1", 5000);

    const argumento = findMany.mock.calls[0][0];
    expect(argumento.where).toEqual({ estabelecimentoId: "e1" });
    expect(argumento.orderBy).toEqual({ criadoEm: "desc" });
    // Teto de 500: a trilha cresce para sempre, e um limite sem limite viraria
    // leitura de tabela inteira pela URL.
    expect(argumento.take).toBe(500);
  });

  it("limite inválido não vira zero nem negativo", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const servico = new AuditoriaService({
      auditLog: { findMany },
    } as unknown as PrismaService);

    await servico.listar("e1", 0);
    expect(findMany.mock.calls[0][0].take).toBe(1);

    await servico.listar("e1", -10);
    expect(findMany.mock.calls[1][0].take).toBe(1);
  });

  it("traz o nome do autor, e não só o identificador", async () => {
    // A trilha é lida pelo dono, que precisa saber **quem** — "u_clx123" não
    // responde à pergunta que a trilha existe para responder.
    const findMany = jest.fn().mockResolvedValue([]);
    const servico = new AuditoriaService({
      auditLog: { findMany },
    } as unknown as PrismaService);

    await servico.listar("e1");

    expect(findMany.mock.calls[0][0].select.autor).toEqual({
      select: { id: true, nome: true },
    });
  });
});

describe("o decorador", () => {
  it("guarda a descrição como metadado da rota", () => {
    // A lista de ações sensíveis fica **na própria rota**, e não numa lista
    // paralela noutro arquivo — lista paralela é a quarta forma de duas
    // cópias de uma verdade, e este projeto já teve as outras três.
    class Alvo {
      @Auditar({ acao: "pausar quadra", entidade: "Quadra", parametro: "quadraId" })
      metodo() {
        return undefined;
      }
    }

    const reflector = new Reflector();
    expect(reflector.get("acao_auditada", Alvo.prototype.metodo)).toEqual({
      acao: "pausar quadra",
      entidade: "Quadra",
      parametro: "quadraId",
    });
  });
});
