// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { entrar } from "./acoes";

const gravarToken = vi.fn();
vi.mock("@/lib/auth/sessao", () => ({ gravarToken: (t: string) => gravarToken(t) }));

/**
 * **A ação de entrar, que estava sem nenhuma cobertura.**
 *
 * As *Server Actions* eram a lacuna nomeada na configuração de cobertura da
 * web: de 0% a 17%. Elas não são código de interface — são o que roda **no
 * servidor**, e nelas moram as decisões que a tela não pode desfazer.
 *
 * Nesta, a que mais importa é a **mensagem única**: dizer "e-mail não
 * cadastrado" entregaria a quem tenta adivinhar que aquele endereço tem conta
 * na arena, e a lista de clientes sai de perguntas repetidas. A API já
 * responde genérico; se a tela distinguisse, desfaria a decisão do servidor.
 */

const SESSAO = {
  accessToken: "jwt.de.teste",
  user: { id: "u1", nome: "Lucas", email: "lucas@arena.com.br" },
};

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.set(chave, valor);
  return dados;
}

function resposta(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response;
}

describe("entrar", () => {
  beforeEach(() => {
    gravarToken.mockReset();
    vi.mocked(redirect).mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sucesso grava o token e leva ao painel", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta(SESSAO));

    await entrar({}, formulario({ email: "lucas@arena.com.br", senha: "senha123" }));

    expect(gravarToken).toHaveBeenCalledWith("jwt.de.teste");
    expect(redirect).toHaveBeenCalledWith("/gestao");
  });

  it("manda a senha no corpo e nunca na URL", async () => {
    // Senha em parâmetro de consulta entra no log de qualquer proxy e no
    // histórico do navegador. Vai no corpo, com POST.
    vi.mocked(fetch).mockResolvedValue(resposta(SESSAO));

    await entrar({}, formulario({ email: "a@b.com", senha: "segredo" }));

    const [url, opcoes] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("segredo");
    expect(opcoes?.method).toBe("POST");
    expect(opcoes?.body).toBe(
      JSON.stringify({ email: "a@b.com", senha: "segredo" }),
    );
    expect(opcoes?.cache).toBe("no-store");
  });

  it("apara o e-mail, mas não a senha", async () => {
    // Espaço acidental no e-mail é erro de digitação; na senha, pode ser a
    // senha. Aparar os dois faria a pessoa não conseguir entrar com a senha
    // que ela cadastrou.
    vi.mocked(fetch).mockResolvedValue(resposta(SESSAO));

    await entrar({}, formulario({ email: "  a@b.com  ", senha: " com espaco " }));

    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(
      JSON.stringify({ email: "a@b.com", senha: " com espaco " }),
    );
  });

  it("campo vazio nem chama a API", async () => {
    expect(await entrar({}, formulario({ email: "", senha: "x" }))).toEqual({
      erro: "Informe e-mail e senha.",
    });
    expect(await entrar({}, formulario({ email: "a@b.com", senha: "" }))).toEqual({
      erro: "Informe e-mail e senha.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("e-mail só com espaços conta como vazio", async () => {
    expect(await entrar({}, formulario({ email: "   ", senha: "x" }))).toEqual({
      erro: "Informe e-mail e senha.",
    });
  });

  it("credencial errada não diz qual dos dois errou", async () => {
    // **A asserção mais importante deste arquivo.** 401 e 404 dão a mesma
    // mensagem, e ela não menciona e-mail nem cadastro.
    for (const status of [401, 404, 403]) {
      vi.mocked(fetch).mockResolvedValue(resposta({ message: "Não existe" }, status));

      const estado = await entrar({}, formulario({ email: "x@y.com", senha: "z" }));

      expect(estado.erro).toBe("E-mail ou senha incorretos.");
      expect(estado.erro).not.toMatch(/cadastrad|não existe|inexistente/i);
    }
  });

  it("falha não grava token nem redireciona", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta(null, 401));

    await entrar({}, formulario({ email: "a@b.com", senha: "x" }));

    expect(gravarToken).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("API fora do ar tem mensagem própria, diferente de credencial errada", async () => {
    // Confundir as duas faria a pessoa tentar outra senha quando o problema é
    // o servidor.
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const estado = await entrar({}, formulario({ email: "a@b.com", senha: "x" }));

    expect(estado.erro).toMatch(/não respondeu/i);
    expect(estado.erro).not.toMatch(/incorretos/i);
  });

  it("resposta fora do contrato não vira sessão", async () => {
    // Sem o `safeParse`, `accessToken: undefined` seria gravado no cookie e
    // toda chamada seguinte responderia 401 sem explicação.
    vi.mocked(fetch).mockResolvedValue(resposta({ user: { id: "u1" } }));

    const estado = await entrar({}, formulario({ email: "a@b.com", senha: "x" }));

    expect(estado.erro).toMatch(/fora do contrato/i);
    expect(gravarToken).not.toHaveBeenCalled();
  });

  it("corpo que não é JSON também é recusado", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error("não é JSON")),
    } as unknown as Response);

    const estado = await entrar({}, formulario({ email: "a@b.com", senha: "x" }));

    expect(estado.erro).toMatch(/fora do contrato/i);
    expect(gravarToken).not.toHaveBeenCalled();
  });
});
