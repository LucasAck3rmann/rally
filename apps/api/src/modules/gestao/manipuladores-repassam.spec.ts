// SPDX-License-Identifier: AGPL-3.0-or-later
import { METHOD_METADATA } from "@nestjs/common/constants";
import type { Response } from "express";

import { AgendaController } from "./agenda.controller";
import { AuditoriaController } from "./auditoria.controller";
import { ConciliacaoController } from "./conciliacao.controller";
import { CuponsController } from "./cupons.controller";
import { EquipeController } from "./equipe.controller";
import { GestaoController } from "./gestao.controller";
import { GestaoModule } from "./gestao.module";
import { PainelController } from "./painel.controller";
import { QuadrasGestaoController } from "./quadras-gestao.controller";
import { RecorrenciasController } from "./recorrencias.controller";
import { RelatoriosController } from "./relatorios.controller";

/**
 * **O que cada manipulador da gestão repassa ao serviço, e em que ordem.**
 *
 * O portão ao lado (`toda-rota-escopada`) prova **quais** parâmetros cada
 * rota lê — foi ele que achou o `materializar` sem arena. Ele não prova a
 * ordem: um manipulador que lesse `estabelecimentoId` e `quadraId` certinho e
 * chamasse `detalhe(quadraId, estabelecimentoId)` passaria por ele.
 *
 * E a troca compila. Os dois são `string`, e o TypeScript não distingue "id
 * de arena" de "id de quadra" — a consulta sairia com os dois trocados, o
 * `findFirst` não acharia nada, e a tela mostraria "não encontrada" numa
 * quadra que existe. Pior: numa consulta que filtre por um e procure pelo
 * outro, a troca **encontra o registro errado**.
 *
 * Nada exercitava estes manipuladores. As suítes de serviço chamam o serviço
 * direto, de modo que a linha entre a rota e ele era o trecho sem teste — 33
 * funções sem nenhuma execução, pelo relatório de cobertura de 26/10.
 *
 * Os valores são palavras que dizem o que são (`"ARENA"`, `"QUADRA"`) em vez
 * de `"a"` e `"b"`: numa troca, a falha do Jest mostra `"QUADRA"` onde se
 * esperava `"ARENA"`, e a leitura resolve sozinha.
 */

const ARENA = "ARENA";
const USUARIO = "USUARIO";

/** Serviço de mentira: todo método existe, registra e devolve uma marca. */
function servicoFalso() {
  return new Proxy({} as Record<string, jest.Mock>, {
    get(alvo, nome: string) {
      alvo[nome] ??= jest.fn().mockResolvedValue({ marca: nome });
      return alvo[nome];
    },
  });
}

function respostaFalsa() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
  } as unknown as Response & { setHeader: jest.Mock; send: jest.Mock };
}

type Caso = {
  /** `Controlador.metodo`, como a varredura do módulo o nomeia. */
  rota: string;
  /** Chama o manipulador com valores distinguíveis. */
  chamar: (servico: Record<string, jest.Mock>) => unknown;
  /** O método do serviço que ele deve chamar, e com o quê. */
  servico: string;
  esperado: unknown[];
};

const CASOS: Caso[] = [
  {
    rota: "AgendaController.doDia",
    chamar: (s) => new AgendaController(s as never).doDia(ARENA, "2026-10-26"),
    servico: "doDia",
    esperado: [ARENA, "2026-10-26"],
  },
  {
    rota: "AgendaController.criarBloqueio",
    chamar: (s) =>
      new AgendaController(s as never).criarBloqueio(ARENA, { motivo: "DTO" } as never),
    servico: "criarBloqueio",
    esperado: [ARENA, { motivo: "DTO" }],
  },
  {
    rota: "AgendaController.moverReserva",
    chamar: (s) =>
      new AgendaController(s as never).moverReserva(ARENA, "RESERVA", {
        inicio: "DTO",
      } as never),
    servico: "moverReserva",
    esperado: [ARENA, "RESERVA", { inicio: "DTO" }],
  },
  {
    rota: "AgendaController.removerBloqueio",
    chamar: (s) => new AgendaController(s as never).removerBloqueio(ARENA, "BLOQUEIO"),
    servico: "removerBloqueio",
    esperado: [ARENA, "BLOQUEIO"],
  },
  {
    rota: "CuponsController.listar",
    chamar: (s) => new CuponsController(s as never).listar(ARENA),
    servico: "listar",
    esperado: [ARENA],
  },
  {
    rota: "CuponsController.criar",
    chamar: (s) => new CuponsController(s as never).criar(ARENA, { codigo: "DTO" } as never),
    servico: "criar",
    esperado: [ARENA, { codigo: "DTO" }],
  },
  {
    rota: "CuponsController.atualizar",
    chamar: (s) =>
      new CuponsController(s as never).atualizar(ARENA, "CUPOM", {
        ativo: false,
      } as never),
    servico: "atualizar",
    esperado: [ARENA, "CUPOM", { ativo: false }],
  },
  {
    rota: "QuadrasGestaoController.listar",
    chamar: (s) => new QuadrasGestaoController(s as never).listar(ARENA),
    servico: "listar",
    esperado: [ARENA],
  },
  {
    rota: "QuadrasGestaoController.detalhe",
    chamar: (s) => new QuadrasGestaoController(s as never).detalhe(ARENA, "QUADRA"),
    servico: "detalhe",
    esperado: [ARENA, "QUADRA"],
  },
  {
    rota: "QuadrasGestaoController.criar",
    chamar: (s) => new QuadrasGestaoController(s as never).criar(ARENA, { nome: "DTO" } as never),
    servico: "criar",
    esperado: [ARENA, { nome: "DTO" }],
  },
  {
    rota: "QuadrasGestaoController.atualizar",
    chamar: (s) =>
      new QuadrasGestaoController(s as never).atualizar(ARENA, "QUADRA", {
        nome: "DTO",
      } as never),
    servico: "atualizar",
    esperado: [ARENA, "QUADRA", { nome: "DTO" }],
  },
  {
    rota: "EquipeController.listar",
    chamar: (s) => new EquipeController(s as never).listar(ARENA),
    servico: "listar",
    esperado: [ARENA],
  },
  {
    rota: "EquipeController.adicionar",
    chamar: (s) =>
      new EquipeController(s as never).adicionar(ARENA, {
        email: "EMAIL",
        papel: "PAPEL",
      } as never),
    servico: "adicionar",
    // Desmonta o DTO: o serviço recebe e-mail e papel, não o objeto.
    esperado: [ARENA, "EMAIL", "PAPEL"],
  },
  {
    rota: "EquipeController.trocarPapel",
    chamar: (s) =>
      new EquipeController(s as never).trocarPapel(
        ARENA,
        "ALVO",
        { papel: "PAPEL" } as never,
        { sub: USUARIO } as never,
      ),
    servico: "trocarPapel",
    // **Quatro argumentos, e os dois últimos são pessoas diferentes:** o
    // usuário alvo da troca e quem pediu. Trocá-los faria a recusa de
    // "rebaixar a si mesmo sendo o único admin" proteger a pessoa errada.
    esperado: [ARENA, "ALVO", "PAPEL", USUARIO],
  },
  {
    rota: "EquipeController.remover",
    chamar: (s) =>
      new EquipeController(s as never).remover(ARENA, "ALVO", {
        sub: USUARIO,
      } as never),
    servico: "remover",
    esperado: [ARENA, "ALVO", USUARIO],
  },
  {
    rota: "RecorrenciasController.listar",
    chamar: (s) => new RecorrenciasController(s as never).listar(ARENA),
    servico: "listar",
    esperado: [ARENA],
  },
  {
    rota: "RecorrenciasController.criar",
    chamar: (s) =>
      new RecorrenciasController(s as never).criar(ARENA, { quadraId: "DTO" } as never),
    servico: "criar",
    esperado: [ARENA, { quadraId: "DTO" }],
  },
  {
    rota: "RecorrenciasController.editar",
    chamar: (s) =>
      new RecorrenciasController(s as never).editar(ARENA, "SERIE", {
        preco: 1,
      } as never),
    servico: "editar",
    esperado: [ARENA, "SERIE", { preco: 1 }],
  },
  {
    rota: "RecorrenciasController.materializar",
    chamar: (s) => new RecorrenciasController(s as never).materializar(ARENA, "SERIE"),
    servico: "materializar",
    // A rota do defeito de 26/10: chamava `materializar(id)` sem a arena.
    esperado: [ARENA, "SERIE"],
  },
  {
    rota: "RecorrenciasController.encerrar",
    chamar: (s) => new RecorrenciasController(s as never).encerrar(ARENA, "SERIE"),
    servico: "encerrar",
    esperado: [ARENA, "SERIE"],
  },
  {
    rota: "ConciliacaoController.relatorio",
    chamar: (s) => new ConciliacaoController(s as never).relatorio(ARENA),
    servico: "relatorio",
    esperado: [ARENA],
  },
  {
    rota: "ConciliacaoController.expirar",
    chamar: (s) => new ConciliacaoController(s as never).expirar(ARENA),
    servico: "expirarPendentes",
    esperado: [{ estabelecimentoId: ARENA }],
  },
  {
    rota: "PainelController.resumo",
    chamar: (s) => new PainelController(s as never).resumo(ARENA, "30"),
    servico: "resumo",
    // O `dias` chega da consulta como texto e vai ao serviço como número.
    esperado: [ARENA, 30],
  },
  {
    rota: "AuditoriaController.listar",
    chamar: (s) => new AuditoriaController(s as never).listar(ARENA, "250"),
    servico: "listar",
    esperado: [ARENA, 250],
  },
  {
    rota: "RelatoriosController.relatorio",
    chamar: (s) => new RelatoriosController(s as never).relatorio(ARENA, "DE", "ATE"),
    servico: "relatorio",
    esperado: [ARENA, "DE", "ATE"],
  },
  {
    rota: "RelatoriosController.csv",
    chamar: (s) => new RelatoriosController(s as never).csv(ARENA, "DE", "ATE", respostaFalsa()),
    servico: "csv",
    esperado: [ARENA, "DE", "ATE"],
  },
  {
    rota: "RelatoriosController.xlsx",
    chamar: (s) => new RelatoriosController(s as never).xlsx(ARENA, "DE", "ATE", respostaFalsa()),
    servico: "xlsx",
    esperado: [ARENA, "DE", "ATE"],
  },
  {
    rota: "RelatoriosController.pdf",
    chamar: (s) => new RelatoriosController(s as never).pdf(ARENA, "DE", "ATE", respostaFalsa()),
    servico: "pdf",
    esperado: [ARENA, "DE", "ATE"],
  },
  {
    rota: "GestaoController.meusEstabelecimentos",
    chamar: (s) => new GestaoController(s as never).meusEstabelecimentos({ sub: USUARIO } as never),
    servico: "meusEstabelecimentos",
    // A única da gestão que não é de arena: ela **descobre** quais existem,
    // e por isso leva o usuário do token e nenhum estabelecimento.
    esperado: [USUARIO],
  },
];

/** As rotas que o módulo registra, que é a fonte contra a qual a tabela vale. */
function rotasDoModulo(): string[] {
  const controladores = (Reflect.getMetadata("controllers", GestaoModule) ?? []) as {
    name: string;
    prototype: object;
  }[];
  const nomes: string[] = [];
  for (const controlador of controladores) {
    const proto = controlador.prototype as unknown as Record<string, unknown>;
    for (const nome of Object.getOwnPropertyNames(proto)) {
      if (nome === "constructor") continue;
      const alvo = proto[nome];
      if (typeof alvo !== "function") continue;
      if (Reflect.getMetadata(METHOD_METADATA, alvo) === undefined) continue;
      nomes.push(`${controlador.name}.${nome}`);
    }
  }
  return nomes;
}

describe("os manipuladores da gestão repassam o que receberam", () => {
  it("a tabela cobre toda rota que o módulo registra", () => {
    // **A âncora.** A tabela acima é escrita à mão, e tabela à mão envelhece
    // calada — foi o que aconteceu com a lista do portão de auditoria, que
    // não via o `RecorrenciasController` porque ninguém o acrescentou. Aqui a
    // lista à mão é inevitável (cada manipulador tem sua assinatura), então a
    // alimentação ganha portão: rota nova no módulo sem caso aqui reprova.
    const naTabela = new Set(CASOS.map((c) => c.rota));
    const semCaso = rotasDoModulo().filter((r) => !naTabela.has(r));

    expect(semCaso).toEqual([]);
    // E o contrário: caso que aponta para rota que não existe mais.
    const registradas = new Set(rotasDoModulo());
    expect(CASOS.map((c) => c.rota).filter((r) => !registradas.has(r))).toEqual([]);
  });

  it.each(CASOS.map((c) => [c.rota, c] as const))("%s", async (_rota, caso) => {
    const servico = servicoFalso();

    await caso.chamar(servico);

    expect(servico[caso.servico]).toHaveBeenCalledTimes(1);
    expect(servico[caso.servico]).toHaveBeenCalledWith(...caso.esperado);
  });

  it("os três formatos de relatório mandam o nome do arquivo e o conteúdo", async () => {
    // O manipulador faz mais que repassar: ele monta a resposta. Se o
    // `Content-Disposition` perdesse o nome, o arquivo chegaria com o nome da
    // rota — `csv`, `xlsx` — e sem extensão em alguns navegadores.
    for (const formato of ["csv", "xlsx", "pdf"] as const) {
      const servico = servicoFalso();
      servico[formato].mockResolvedValue({
        arquivo: `rally-${formato}.${formato}`,
        conteudo: "CONTEUDO",
      });
      const resposta = respostaFalsa();

      await new RelatoriosController(servico as never)[formato](ARENA, "DE", "ATE", resposta);

      const disposicao = resposta.setHeader.mock.calls.find(
        ([nome]) => nome === "Content-Disposition",
      );
      expect(disposicao?.[1]).toContain(`rally-${formato}.${formato}`);
      expect(resposta.send).toHaveBeenCalledWith("CONTEUDO");
    }
  });

  it("expirar pendentes devolve quantas liberou, e não o objeto do serviço", async () => {
    // A tela mostra o número. Devolver o objeto inteiro vazaria o formato
    // interno do serviço para a resposta da API.
    const servico = servicoFalso();
    servico.expirarPendentes.mockResolvedValue(7);

    const r = await new ConciliacaoController(servico as never).expirar(ARENA);

    expect(r).toEqual({ liberadas: 7 });
  });
});
