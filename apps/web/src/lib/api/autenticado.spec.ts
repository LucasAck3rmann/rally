// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ErroDeApi } from "./client";
import { chamarApiAutenticada, SemSessao } from "./autenticado";

const lerToken = vi.fn();
vi.mock("../auth/sessao", () => ({ lerToken: () => lerToken() }));

/**
 * **O cliente autenticado do painel.**
 *
 * Estava em **0% de cobertura**, e é por onde passa toda leitura e escrita da
 * gestão. Quatro decisões moram aqui e nenhuma delas estava verificada: que a
 * resposta **nunca** é cacheada, que o 401 é traduzido para "a sessão
 * acabou" em vez de "deu erro", que a mensagem exibida ao usuário é a que a
 * API escreveu em português, e que resposta fora do contrato **falha alto**
 * em vez de espalhar `undefined` pela árvore de componentes.
 *
 * A última é a que mais vale: sem ela, uma mudança não anunciada na API
 * aparece como tela em branco ou `NaN` numa célula de relatório, longe da
 * causa. Com ela, aparece como erro que diz qual caminho saiu do contrato.
 */

const Quadra = z.object({ id: z.string(), nome: z.string() });

function resposta(
  corpo: unknown,
  { status = 200, json = true }: { status?: number; json?: boolean } = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: json ? () => Promise.resolve(corpo) : () => Promise.reject(new Error("corpo não é JSON")),
  } as Response;
}

describe("chamarApiAutenticada", () => {
  beforeEach(() => {
    lerToken.mockReset().mockResolvedValue("token-bom");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda o token no cabeçalho e nunca cacheia", async () => {
    // `no-store` é a decisão que separa esta função de `buscarNaApi`: o cache
    // do Next não sabe que a resposta depende de **quem** perguntou, e a
    // agenda de um estabelecimento apareceria para outro.
    vi.mocked(fetch).mockResolvedValue(resposta({ id: "q1", nome: "Quadra 1" }));

    await chamarApiAutenticada("/quadras/q1", Quadra);

    const [, opcoes] = vi.mocked(fetch).mock.calls[0];
    expect(opcoes?.cache).toBe("no-store");
    expect((opcoes?.headers as Record<string, string>).Authorization).toBe("Bearer token-bom");
  });

  it("sem token, nem chega a chamar a API", async () => {
    lerToken.mockResolvedValue(null);

    await expect(chamarApiAutenticada("/quadras", Quadra)).rejects.toThrow(SemSessao);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("401 vira SemSessao, e não erro genérico", async () => {
    // A diferença decide a tela: sessão expirada manda para a entrada,
    // "deu erro" mostra uma mensagem que a pessoa não consegue resolver.
    vi.mocked(fetch).mockResolvedValue(resposta(null, { status: 401 }));

    await expect(chamarApiAutenticada("/quadras", Quadra)).rejects.toThrow(SemSessao);
  });

  it("usa a mensagem que a API escreveu", async () => {
    vi.mocked(fetch).mockResolvedValue(
      resposta({ message: "Você é o único administrador desta arena." }, { status: 409 }),
    );

    await expect(chamarApiAutenticada("/gestao/equipe", Quadra)).rejects.toThrow(
      "Você é o único administrador desta arena.",
    );
  });

  it("mensagem em lista usa a primeira, que é a do class-validator", async () => {
    // O `ValidationPipe` do Nest devolve `message` como array. Exibir o array
    // inteiro, ou `[object Object]`, perderia a única frase útil.
    vi.mocked(fetch).mockResolvedValue(
      resposta({ message: ["O código do cupom é obrigatório.", "e mais uma"] }, { status: 400 }),
    );

    await expect(chamarApiAutenticada("/cupons", Quadra)).rejects.toThrow(
      "O código do cupom é obrigatório.",
    );
  });

  it("erro sem corpo legível ainda diz o status e o caminho", async () => {
    // 502 de proxy costuma vir em HTML. Sem este caminho, o `json()` estoura
    // e o usuário vê uma falha de parse em vez do erro real.
    vi.mocked(fetch).mockResolvedValue(resposta(null, { status: 502, json: false }));

    await expect(chamarApiAutenticada("/painel", Quadra)).rejects.toThrow(/502 em \/painel/);
  });

  it("API fora do ar vira ErroDeApi com status 0", async () => {
    // `fetch` rejeita quando não há rota até o servidor. Status 0 é o que o
    // `foraDoAr` do `ErroDeApi` usa para distinguir ambiente caído de dado
    // inexistente.
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const erro = await chamarApiAutenticada("/painel", Quadra).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.status).toBe(0);
    expect(erro.foraDoAr).toBe(true);
  });

  it("resposta fora do contrato falha alto", async () => {
    // **A asserção que mais importa.** Sem ela, `nome: undefined` desce pela
    // árvore de componentes e quebra numa tela qualquer, longe da causa.
    vi.mocked(fetch).mockResolvedValue(resposta({ id: "q1" }));

    const erro = await chamarApiAutenticada("/quadras/q1", Quadra).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeApi);
    expect(erro.message).toMatch(/fora do contrato/);
    // O erro do zod vai anexado, para o log dizer **qual** campo faltou.
    expect(erro.causa).toBeDefined();
  });

  it("204 não tenta ler corpo", async () => {
    // Uma exclusão devolve 204 sem corpo; chamar `json()` ali estouraria.
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error("não deveria ler")),
    } as unknown as Response);

    await expect(chamarApiAutenticada("/privacidade/minha-conta", Quadra)).resolves.toBeUndefined();
  });

  it("monta os parâmetros de consulta, ignorando os ausentes", async () => {
    // `undefined` tem de sair da URL, e não virar `?dias=undefined` — que a
    // API leria como texto e recusaria.
    vi.mocked(fetch).mockResolvedValue(resposta({ id: "q1", nome: "Q" }));

    await chamarApiAutenticada("/painel", Quadra, {
      parametros: { dias: 7, de: undefined },
    });

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("dias=7");
    expect(url).not.toContain("de=");
  });

  it("escrita leva método, corpo e Content-Type juntos", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta({ id: "c1", nome: "Cupom" }));

    await chamarApiAutenticada("/cupons", Quadra, {
      metodo: "POST",
      corpo: { codigo: "BORAJOGAR" },
    });

    const [, opcoes] = vi.mocked(fetch).mock.calls[0];
    expect(opcoes?.method).toBe("POST");
    expect(opcoes?.body).toBe(JSON.stringify({ codigo: "BORAJOGAR" }));
    expect((opcoes?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("leitura não manda Content-Type, porque não tem corpo", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta({ id: "q1", nome: "Q" }));

    await chamarApiAutenticada("/quadras/q1", Quadra);

    const [, opcoes] = vi.mocked(fetch).mock.calls[0];
    expect((opcoes?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});
