// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apagarToken, COOKIE_SESSAO, gravarToken, lerToken } from "./sessao";

const loja = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(loja) }));

/**
 * **O cookie de sessão do painel.**
 *
 * Três funções, **nenhuma exercitada** — e o que mora aqui não é acesso a
 * cookie, são as quatro bandeiras que decidem se um XSS carrega a sessão
 * embora. O arquivo explica cada uma em comentário; comentário não reprova
 * quando alguém troca `httpOnly: true` por `false` para "resolver" um
 * problema de leitura no cliente.
 *
 * A bandeira que mais pede teste é a `secure` **condicional**: ela é `false`
 * em desenvolvimento porque o navegador descarta cookie seguro em
 * `http://localhost` e o login falharia sem dizer por quê. Uma condição que
 * depende de `NODE_ENV` tem dois lados, e o lado de produção é justamente o
 * que nenhuma execução local percorre. Se ele inverter, o sintoma aparece
 * só no ambiente onde importa.
 */

describe("sessão do painel", () => {
  beforeEach(() => {
    loja.get.mockReset();
    loja.set.mockReset();
    loja.delete.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lê o token do cookie da sessão", async () => {
    loja.get.mockReturnValue({ name: COOKIE_SESSAO, value: "token-bom" });

    await expect(lerToken()).resolves.toBe("token-bom");
    expect(loja.get).toHaveBeenCalledWith(COOKIE_SESSAO);
  });

  it("devolve null quando não há cookie, e não undefined", async () => {
    // A diferença importa: quem chama compara com `null` para decidir entre
    // "a sessão acabou" e "deu erro" — `chamarApiAutenticada` lança
    // `SemSessao` nesse ponto, e `repassarArquivo` manda para o login.
    loja.get.mockReturnValue(undefined);

    await expect(lerToken()).resolves.toBeNull();
  });

  it("grava o token fora do alcance do JavaScript da página", async () => {
    await gravarToken("token-novo");

    const [nome, valor, opcoes] = loja.set.mock.calls[0];
    expect(nome).toBe(COOKIE_SESSAO);
    expect(valor).toBe("token-novo");
    // `httpOnly` é a razão de o cookie existir em vez de `localStorage`:
    // script na página não o lê, então um XSS não o carrega embora.
    expect(opcoes.httpOnly).toBe(true);
    expect(opcoes.sameSite).toBe("lax");
    expect(opcoes.path).toBe("/");
  });

  it("dura o mesmo que o JWT da API: um dia", async () => {
    // Guardar por mais tempo que o token só trocaria "sessão expirada" por
    // "401 inexplicável" — o cookie sobreviveria ao que ele carrega.
    await gravarToken("token-novo");

    const [, , opcoes] = loja.set.mock.calls[0];
    expect(opcoes.maxAge).toBe(60 * 60 * 24);
  });

  it("não marca `secure` em desenvolvimento, senão o login falharia calado", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await gravarToken("token-novo");

    const [, , opcoes] = loja.set.mock.calls[0];
    expect(opcoes.secure).toBe(false);
  });

  it("marca `secure` em produção, que é o lado que nenhuma execução local percorre", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await gravarToken("token-novo");

    const [, , opcoes] = loja.set.mock.calls[0];
    expect(opcoes.secure).toBe(true);
  });

  it("apaga o cookie da sessão ao sair", async () => {
    await apagarToken();

    expect(loja.delete).toHaveBeenCalledWith(COOKIE_SESSAO);
  });
});
