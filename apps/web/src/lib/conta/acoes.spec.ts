// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SemSessao } from "../api/autenticado";
import { ErroDeApi } from "../api/client";
import { excluirMinhaConta } from "./acoes";

const chamarApiAutenticada = vi.fn();
const apagarToken = vi.fn();

// `importOriginal` em vez de reimplementar as classes: `vi.mock` e hoisted
// acima de qualquer declaracao do arquivo, e declarar `SemSessao` aqui para
// usar dentro da fabrica da um `Cannot access before initialization`. Alem
// disso, usar as classes **reais** e o que faz o teste verificar o `instanceof`
// que a acao de fato executa.
vi.mock("../api/autenticado", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/autenticado")>()),
  chamarApiAutenticada: (...args: unknown[]) => chamarApiAutenticada(...args),
}));
vi.mock("../auth/sessao", () => ({ apagarToken: () => apagarToken() }));

/**
 * **A exclusão de conta do painel (RNF-07, LGPD).**
 *
 * A decisão que esta suíte existe para prender é a **ordem**: o cookie só é
 * apagado depois de a API confirmar. Na ordem inversa, a recusa ao último
 * administrador — que a API faz de propósito — deixaria a pessoa **fora do
 * painel com a conta intacta e sem ver o motivo**, que é justamente a parte
 * acionável da recusa ("promova outra pessoa antes").
 *
 * É uma ordem que parece arbitrária lendo o código e que decide se a falha é
 * recuperável ou não.
 */
describe("excluirMinhaConta", () => {
  beforeEach(() => {
    chamarApiAutenticada.mockReset();
    apagarToken.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chama DELETE na rota do titular", async () => {
    chamarApiAutenticada.mockResolvedValue({ ok: true, anonimizadoEm: "2026-10-15" });

    await excluirMinhaConta();

    const [caminho, , opcoes] = chamarApiAutenticada.mock.calls[0] as [
      string,
      unknown,
      { metodo: string },
    ];
    expect(caminho).toBe("/privacidade/minha-conta");
    expect(opcoes.metodo).toBe("DELETE");
  });

  it("confirmado, apaga o cookie — e só depois", async () => {
    const ordem: string[] = [];
    chamarApiAutenticada.mockImplementation(async () => {
      ordem.push("api");
      return { ok: true, anonimizadoEm: "2026-10-15" };
    });
    apagarToken.mockImplementation(async () => {
      ordem.push("cookie");
    });

    await expectOk(excluirMinhaConta());

    expect(ordem).toEqual(["api", "cookie"]);
  });

  it("recusado, o cookie NÃO é apagado", async () => {
    // **A asserção que mais importa.** É o caso do último administrador: a
    // conta continua existindo, então a sessão tem de continuar valendo para
    // a pessoa ler o motivo e resolver.
    chamarApiAutenticada.mockRejectedValue(
      new ErroDeApi(
        409,
        "Você é o único administrador de Arena Beira-Rio. Promova outra " +
          "pessoa a administrador antes de excluir a conta.",
      ),
    );

    const resultado = await excluirMinhaConta();

    expect(resultado.ok).toBe(false);
    expect(apagarToken).not.toHaveBeenCalled();
  });

  it("a mensagem da API chega inteira, porque é a parte acionável", async () => {
    chamarApiAutenticada.mockRejectedValue(
      new ErroDeApi(409, "Promova outra pessoa a administrador antes."),
    );

    const resultado = await excluirMinhaConta();

    expect(resultado).toEqual({
      ok: false,
      erro: "Promova outra pessoa a administrador antes.",
    });
  });

  it("sessão expirada não vira 'deu erro'", async () => {
    // A distinção decide a tela: sessão expirada manda entrar de novo; "deu
    // erro" faz a pessoa tentar excluir outra vez e falhar igual.
    chamarApiAutenticada.mockRejectedValue(new SemSessao());

    const resultado = await excluirMinhaConta();

    expect(resultado).toEqual({ ok: false, erro: "Sua sessão expirou. Entre de novo." });
    expect(apagarToken).not.toHaveBeenCalled();
  });

  it("erro desconhecido não vaza detalhe interno", async () => {
    chamarApiAutenticada.mockRejectedValue(new TypeError("cannot read x of undefined"));

    const resultado = await excluirMinhaConta();

    expect(resultado.ok).toBe(false);
    expect(resultado).toEqual({
      ok: false,
      erro: "Não foi possível concluir. Tente de novo.",
    });
  });

  it("falha ao limpar o cookie não desfaz a exclusão", async () => {
    // A conta já não existe quando isto acontece. Devolver "não foi possível
    // excluir" faria a pessoa tentar de novo uma ação que já aconteceu — e a
    // segunda tentativa responderia 401, confundindo ainda mais.
    chamarApiAutenticada.mockResolvedValue({ ok: true, anonimizadoEm: "2026-10-15" });
    apagarToken.mockRejectedValue(new Error("falha no cookie"));

    await expect(excluirMinhaConta()).rejects.toThrow("falha no cookie");
    // A chamada à API aconteceu: a exclusão não foi revertida.
    expect(chamarApiAutenticada).toHaveBeenCalledTimes(1);
  });
});

async function expectOk(promessa: Promise<{ ok: boolean }>) {
  const resultado = await promessa;
  expect(resultado.ok).toBe(true);
  return resultado;
}
