// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pedirLink, redefinir } from "./acoes";

/**
 * **As ações de recuperação de senha (RF-03).**
 *
 * A propriedade que estas duas precisam manter é a mais fácil de desfazer sem
 * perceber: **nenhuma resposta pode revelar se a conta existe.** A API já
 * responde igual para endereço cadastrado e não cadastrado — por decisão de
 * segurança explícita, documentada no `senha.service.ts` —, e se a tela
 * distinguisse os casos, desfaria a decisão do servidor. Duas telas
 * diferentes para dois destinos seriam uma lista de clientes da arena.
 *
 * Na redefinição, a decisão que importa é outra: a conferência das duas
 * senhas acontece **no servidor**, e não só no navegador. O formulário
 * funciona sem JavaScript, e sem essa checagem a conta sairia com a senha que
 * a pessoa digitou errado nos dois campos sem perceber.
 */

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(campos)) dados.set(chave, valor);
  return dados;
}

function resposta(corpo: unknown, status = 200, json = true) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: json ? () => Promise.resolve(corpo) : () => Promise.reject(new Error("não é JSON")),
  } as Response;
}

beforeEach(() => {
  vi.mocked(redirect).mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pedirLink", () => {
  it("sucesso devolve enviado, sem dizer para quem", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta({ ok: true }));

    const estado = await pedirLink({}, formulario({ email: "lucas@arena.com.br" }));

    expect(estado).toEqual({ enviado: true });
    // Nada no estado nomeia o destinatário: a tela que o exibisse confirmaria
    // o endereço a quem o digitou por tentativa.
    expect(JSON.stringify(estado)).not.toContain("lucas@arena.com.br");
  });

  it("nenhuma falha revela que a conta não existe", async () => {
    // **A asserção que mais importa.** Percorre os status que a API pode
    // devolver e confere que nenhuma mensagem menciona existência de conta.
    for (const status of [401, 403, 404, 409, 500, 502]) {
      vi.mocked(fetch).mockResolvedValue(resposta({ message: "Usuário não encontrado" }, status));

      const estado = await pedirLink({}, formulario({ email: "x@y.com" }));

      expect(estado.erro, `status ${status}`).not.toMatch(
        /não existe|inexistente|não encontrad|não cadastrad/i,
      );
      expect(estado.enviado).toBeUndefined();
    }
  });

  it("não repassa a mensagem da API, ao contrário da redefinição", async () => {
    // Aqui a mensagem do servidor **não** é usada de propósito: ela poderia
    // vazar o que esta ação existe para esconder. Na redefinição é o oposto,
    // porque lá a mensagem fala do token e não da conta.
    vi.mocked(fetch).mockResolvedValue(
      resposta({ message: "E-mail lucas@arena.com.br não está cadastrado" }, 404),
    );

    const estado = await pedirLink({}, formulario({ email: "lucas@arena.com.br" }));

    expect(estado.erro).toBe("Não foi possível enviar agora. Tente de novo.");
  });

  it("400 é formato inválido, que o campo já barra", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta({ message: "email must be" }, 400));

    expect(await pedirLink({}, formulario({ email: "sem-arroba" }))).toEqual({
      erro: "Informe um e-mail válido.",
    });
  });

  it("429 diz o que fazer, porque 'tente de novo' é o que não resolve", async () => {
    // É o limite de tentativas do #89. A mensagem precisa dizer que o
    // caminho é esperar, senão a pessoa insiste e prolonga o bloqueio.
    vi.mocked(fetch).mockResolvedValue(resposta(null, 429));

    const estado = await pedirLink({}, formulario({ email: "a@b.com" }));

    expect(estado.erro).toMatch(/aguarde/i);
    expect(estado.erro).toMatch(/muitas tentativas/i);
  });

  it("e-mail vazio nem chama a API", async () => {
    expect(await pedirLink({}, formulario({ email: "  " }))).toEqual({
      erro: "Informe o e-mail da conta.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("API fora do ar tem mensagem própria", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    expect((await pedirLink({}, formulario({ email: "a@b.com" }))).erro).toMatch(/não respondeu/i);
  });
});

describe("redefinir", () => {
  const VALIDO = {
    token: "tok",
    senha: "senha123",
    confirmacao: "senha123",
  };

  it("sucesso leva ao login já com o aviso", async () => {
    // Deixar a pessoa numa tela de sucesso sem saída a obrigaria a procurar
    // sozinha onde entrar com a senha nova.
    vi.mocked(fetch).mockResolvedValue(resposta({ ok: true }));

    await redefinir({}, formulario(VALIDO));

    expect(redirect).toHaveBeenCalledWith("/entrar?senha=redefinida");
  });

  it("manda token e senha, e não a confirmação", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta({ ok: true }));

    await redefinir({}, formulario(VALIDO));

    expect(vi.mocked(fetch).mock.calls[0][1]?.body).toBe(
      JSON.stringify({ token: "tok", senha: "senha123" }),
    );
  });

  it("sem token, pede um link novo em vez de tentar", async () => {
    const estado = await redefinir({}, formulario({ ...VALIDO, token: "" }));

    expect(estado.erro).toMatch(/link inválido/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("senha curta é barrada no servidor", async () => {
    const estado = await redefinir(
      {},
      formulario({ ...VALIDO, senha: "12345", confirmacao: "12345" }),
    );

    expect(estado.erro).toMatch(/6 caracteres/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("senhas diferentes são barradas no servidor, não só no navegador", async () => {
    // O formulário funciona sem JavaScript. Sem esta checagem, a conta sairia
    // com a senha que a pessoa digitou errado nos dois campos sem perceber —
    // e ela não conseguiria mais entrar, sem saber por quê.
    const estado = await redefinir({}, formulario({ ...VALIDO, confirmacao: "outra123" }));

    expect(estado.erro).toMatch(/não são iguais/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a ordem das validações protege a mais específica", async () => {
    // Token ausente **e** senha curta: a mensagem é do token, porque pedir um
    // link novo é o que resolve — corrigir a senha num link inválido não.
    const estado = await redefinir({}, formulario({ token: "", senha: "1", confirmacao: "2" }));

    expect(estado.erro).toMatch(/link inválido/i);
  });

  it("usa a mensagem da API, que distingue inválido de vencido", async () => {
    // Aqui, ao contrário do `pedirLink`, a mensagem do servidor é a parte
    // útil: ela fala do **token**, não da conta, e diz se o link já foi usado
    // ou se venceu.
    vi.mocked(fetch).mockResolvedValue(resposta({ message: "Este link já foi usado." }, 400));

    expect((await redefinir({}, formulario(VALIDO))).erro).toBe("Este link já foi usado.");
  });

  it("limite de tentativas não repassa a mensagem do framework", async () => {
    // O repasse acima é útil porque a API fala do token. A recusa do
    // limitador não: ela vem do framework, em inglês, e mostrá-la a quem
    // está redefinindo a senha troca uma instrução por um nome de exceção.
    vi.mocked(fetch).mockResolvedValue(
      resposta({ message: "ThrottlerException: Too Many Requests" }, 429),
    );

    const estado = await redefinir({}, formulario(VALIDO));

    expect(estado.erro).toMatch(/muitas tentativas/i);
    expect(estado.erro).not.toMatch(/throttler|too many/i);
  });

  it("mensagem em lista usa a primeira, que é a do validador", async () => {
    vi.mocked(fetch).mockResolvedValue(
      resposta({ message: ["A senha é obrigatória.", "e outra"] }, 400),
    );

    expect((await redefinir({}, formulario(VALIDO))).erro).toBe("A senha é obrigatória.");
  });

  it("erro sem corpo legível cai no texto que diz o que fazer", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta(null, 502, false));

    expect((await redefinir({}, formulario(VALIDO))).erro).toMatch(/peça um novo link/i);
  });

  it("falha não redireciona", async () => {
    vi.mocked(fetch).mockResolvedValue(resposta({ message: "x" }, 400));

    await redefinir({}, formulario(VALIDO));

    expect(redirect).not.toHaveBeenCalled();
  });

  it("API fora do ar tem mensagem própria", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    expect((await redefinir({}, formulario(VALIDO))).erro).toMatch(/não respondeu/i);
  });
});
