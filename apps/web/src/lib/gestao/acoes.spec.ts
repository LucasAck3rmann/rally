// SPDX-License-Identifier: AGPL-3.0-or-later
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SemSessao } from "../api/autenticado";
import { ErroDeApi } from "../api/client";
import * as acoes from "./acoes";

const chamarApiAutenticada = vi.fn();

// `importOriginal` para manter as classes reais: é o `instanceof` delas que a
// tradução do erro executa, e reimplementá-las aqui testaria o dublê.
vi.mock("../api/autenticado", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/autenticado")>()),
  chamarApiAutenticada: (...args: unknown[]) => chamarApiAutenticada(...args),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * **As escritas do painel, que estavam sem cobertura.**
 *
 * Eram a lacuna nomeada na configuração de cobertura da web. Como na API, não
 * escrevi uma suíte por ação: todas compartilham **três propriedades** que
 * nenhuma declara sozinha, e é delas que esta suíte trata.
 *
 * 1. **Toda rota carrega o estabelecimento pedido** — o isolamento do
 *    ADR-0011 visto da web, e nenhum identificador é tipado, de modo que uma
 *    troca de ordem passa pelo compilador.
 * 2. **A revalidação é de `layout`, não de `page`** — a barra lateral mostra a
 *    contagem de quadras, e revalidar só a página deixaria o número velho ao
 *    lado do dado novo.
 * 3. **Escrita que falha não revalida** — revalidar depois de uma recusa faz a
 *    interface recarregar como se algo tivesse mudado, e a pessoa não sabe se
 *    a ação valeu.
 *
 * E a tradução do erro, que decide o que a pessoa lê: sessão expirada não é
 * "deu erro", e a mensagem da API é a que diz o que fazer.
 */

const ARENA = "e-da-arena";
const OUTRA = "e-de-outra-arena";

/** Cada ação, com o jeito de invocá-la e o que a rota deve conter. */
const ESCRITAS: {
  nome: string;
  executar: () => Promise<acoes.Resultado>;
  caminho: string;
  metodo: string;
}[] = [
  {
    nome: "pausarQuadra",
    executar: () => acoes.pausarQuadra(ARENA, "q1", false),
    caminho: `/gestao/estabelecimentos/${ARENA}/quadras/q1`,
    metodo: "PATCH",
  },
  {
    nome: "bloquearHorario",
    executar: () =>
      acoes.bloquearHorario(ARENA, {
        quadraId: "q1",
        inicio: "2026-10-20T22:00:00.000Z",
        fim: "2026-10-20T23:00:00.000Z",
      }),
    caminho: `/gestao/estabelecimentos/${ARENA}/bloqueios`,
    metodo: "POST",
  },
  {
    nome: "liberarHorario",
    executar: () => acoes.liberarHorario(ARENA, "b1"),
    caminho: `/gestao/estabelecimentos/${ARENA}/bloqueios/b1`,
    metodo: "DELETE",
  },
  {
    nome: "moverReserva",
    executar: () =>
      acoes.moverReserva(ARENA, "r1", {
        inicio: "2026-10-20T22:00:00.000Z",
        fim: "2026-10-20T23:00:00.000Z",
      }),
    caminho: `/gestao/estabelecimentos/${ARENA}/reservas/r1/mover`,
    metodo: "PATCH",
  },
  {
    nome: "criarCupom",
    executar: () =>
      acoes.criarCupom(ARENA, {
        codigo: "BORAJOGAR",
        tipo: "PERCENTUAL",
        valor: 20,
        validadeInicio: "2026-10-01",
        validadeFim: "2026-11-30",
      } as Parameters<typeof acoes.criarCupom>[1]),
    caminho: `/gestao/estabelecimentos/${ARENA}/cupons`,
    metodo: "POST",
  },
  {
    nome: "alternarCupom",
    executar: () => acoes.alternarCupom(ARENA, "c1", false),
    caminho: `/gestao/estabelecimentos/${ARENA}/cupons/c1`,
    metodo: "PATCH",
  },
  {
    nome: "adicionarMembro",
    executar: () =>
      acoes.adicionarMembro(ARENA, {
        email: "augusto@rally.com.br",
        papel: "ATENDENTE",
      }),
    caminho: `/gestao/estabelecimentos/${ARENA}/equipe`,
    metodo: "POST",
  },
  {
    nome: "trocarPapel",
    executar: () => acoes.trocarPapel(ARENA, "u2", "FINANCEIRO"),
    caminho: `/gestao/estabelecimentos/${ARENA}/equipe/u2`,
    metodo: "PATCH",
  },
  {
    nome: "tirarDaEquipe",
    executar: () => acoes.tirarDaEquipe(ARENA, "u2"),
    caminho: `/gestao/estabelecimentos/${ARENA}/equipe/u2`,
    metodo: "DELETE",
  },
  {
    nome: "expirarPendentes",
    executar: () => acoes.expirarPendentes(ARENA),
    caminho: `/gestao/estabelecimentos/${ARENA}/conciliacao/expirar-pendentes`,
    metodo: "POST",
  },
  // Mensalistas (ADR-0014). Criar e materializar **ocupam horário**; encerrar
  // devolve os futuros para a venda — as três são escrita de agenda e caem nas
  // mesmas três propriedades que as demais.
  {
    nome: "criarMensalista",
    executar: () =>
      acoes.criarMensalista(ARENA, {
        quadraId: "q1",
        clienteEmail: "augusto@rally.com.br",
        diaSemana: 2,
        horaInicio: "19:00",
        duracaoMinutos: 60,
        vigenciaInicio: "2026-10-01",
        preco: 90,
      }),
    caminho: `/gestao/estabelecimentos/${ARENA}/mensalistas`,
    metodo: "POST",
  },
  {
    nome: "encerrarMensalista",
    executar: () => acoes.encerrarMensalista(ARENA, "s1"),
    caminho: `/gestao/estabelecimentos/${ARENA}/mensalistas/s1`,
    metodo: "DELETE",
  },
  {
    nome: "materializarMensalista",
    executar: () => acoes.materializarMensalista(ARENA, "s1"),
    caminho: `/gestao/estabelecimentos/${ARENA}/mensalistas/s1/materializar`,
    metodo: "POST",
  },
];

beforeEach(() => {
  chamarApiAutenticada.mockReset().mockResolvedValue({ liberadas: 0 });
  vi.mocked(revalidatePath).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("as escritas do painel", () => {
  it("a lista cobre todas as ações exportadas", () => {
    // Âncora: ação nova no módulo sem entrada aqui faz o teste reprovar, em
    // vez de ficar sem cobertura em silêncio. É o que faltou no cenário dos
    // portões de acessibilidade, em que a barra lateral não entrou na lista.
    const exportadas = Object.keys(acoes).filter(
      (chave) => typeof (acoes as Record<string, unknown>)[chave] === "function",
    );
    expect(exportadas.sort()).toEqual(ESCRITAS.map((e) => e.nome).sort());
  });

  it.each(ESCRITAS)(
    "$nome usa $metodo na rota do estabelecimento",
    async ({ executar, caminho, metodo }) => {
      await executar();

      const [rota, , opcoes] = chamarApiAutenticada.mock.calls[0] as [
        string,
        unknown,
        { metodo?: string },
      ];
      expect(rota).toBe(caminho);
      expect(opcoes.metodo).toBe(metodo);
      expect(rota).not.toContain(OUTRA);
    },
  );

  it.each(ESCRITAS)("$nome revalida o layout, e não só a página", async ({ executar }) => {
    await executar();

    expect(revalidatePath).toHaveBeenCalledWith(`/gestao/${ARENA}`, "layout");
  });

  it.each(ESCRITAS)("$nome não revalida quando a API recusa", async ({ executar }) => {
    chamarApiAutenticada.mockRejectedValue(new ErroDeApi(403, "Sem permissão."));

    const resultado = await executar();

    expect(resultado.ok).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("tradução do erro", () => {
  it("sessão expirada diz para entrar de novo", async () => {
    chamarApiAutenticada.mockRejectedValue(new SemSessao());

    expect(await acoes.pausarQuadra(ARENA, "q1", false)).toEqual({
      ok: false,
      erro: "Sua sessão expirou. Entre de novo.",
    });
  });

  it("a mensagem da API chega inteira", async () => {
    // É a que diz o que fazer — "promova outra pessoa a administrador antes".
    chamarApiAutenticada.mockRejectedValue(
      new ErroDeApi(409, "O estabelecimento ficaria sem administrador."),
    );

    expect(await acoes.trocarPapel(ARENA, "u1", "ATENDENTE")).toEqual({
      ok: false,
      erro: "O estabelecimento ficaria sem administrador.",
    });
  });

  it("erro desconhecido não vaza detalhe interno", async () => {
    chamarApiAutenticada.mockRejectedValue(new TypeError("cannot read 'data' of undefined"));

    const resultado = await acoes.tirarDaEquipe(ARENA, "u2");

    expect(resultado).toEqual({
      ok: false,
      erro: "Não foi possível concluir. Tente de novo.",
    });
  });
});

describe("o corpo enviado", () => {
  it("pausar manda só o `ativo`", async () => {
    await acoes.pausarQuadra(ARENA, "q1", false);

    const [, , opcoes] = chamarApiAutenticada.mock.calls[0] as [
      string,
      unknown,
      { corpo?: unknown },
    ];
    expect(opcoes.corpo).toEqual({ ativo: false });
  });

  it("mover reserva repassa o horário sem reescrevê-lo", async () => {
    // A ação recebe o instante já pronto da tela e não o recalcula: fazer a
    // conta duas vezes, em dois fusos, é como o `"25:00"` apareceu.
    await acoes.moverReserva(ARENA, "r1", {
      inicio: "2026-10-20T22:00:00.000Z",
      fim: "2026-10-20T23:00:00.000Z",
      quadraId: "q2",
    });

    const [, , opcoes] = chamarApiAutenticada.mock.calls[0] as [
      string,
      unknown,
      { corpo?: unknown },
    ];
    expect(opcoes.corpo).toEqual({
      inicio: "2026-10-20T22:00:00.000Z",
      fim: "2026-10-20T23:00:00.000Z",
      quadraId: "q2",
    });
  });

  it("trocar papel manda o papel no formato da API", async () => {
    await acoes.trocarPapel(ARENA, "u2", "FINANCEIRO");

    const [, , opcoes] = chamarApiAutenticada.mock.calls[0] as [
      string,
      unknown,
      { corpo?: unknown },
    ];
    expect(opcoes.corpo).toEqual({ papel: "FINANCEIRO" });
  });
});
