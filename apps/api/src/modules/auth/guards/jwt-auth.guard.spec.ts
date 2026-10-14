// SPDX-License-Identifier: AGPL-3.0-or-later
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { JwtPayload } from "../types/jwt-payload";
import { JwtAuthGuard } from "./jwt-auth.guard";

/**
 * **O guarda que decide se há sessão (RNF-06).**
 *
 * Até aqui era o arquivo menos verificado do projeto: 40% de instruções e
 * **0% de ramos**, num componente por onde passa toda rota autenticada. A
 * cobertura de ramos em zero significa que nenhuma das decisões dele era
 * exercitada — nem o cabeçalho ausente, nem o esquema errado, nem o token
 * inválido. O serviço por trás estava testado; a porta, não.
 *
 * O `PapelGuard` decide **o que** a pessoa pode fazer e tem suíte própria
 * desde setembro. Este decide **se é alguém**, e vinha antes na cadeia.
 */

type Requisicao = {
  headers: Record<string, string | undefined>;
  user?: JwtPayload;
};

function contexto(req: Requisicao): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guard(verificar: jest.Mock) {
  return new JwtAuthGuard({ verifyAsync: verificar } as unknown as JwtService);
}

const PAYLOAD: JwtPayload = { sub: "u1", email: "lucas@arena.com.br" };

describe("JwtAuthGuard", () => {
  it("libera e anexa o payload à requisição", async () => {
    // O resto da API lê `req.user`: se o guarda liberasse sem anexar, toda
    // rota autenticada receberia `undefined` onde espera o usuário.
    const verificar = jest.fn().mockResolvedValue(PAYLOAD);
    const req: Requisicao = { headers: { authorization: "Bearer token-bom" } };

    await expect(guard(verificar).canActivate(contexto(req))).resolves.toBe(true);
    expect(req.user).toEqual(PAYLOAD);
  });

  it("passa ao verificador só o token, sem o esquema", async () => {
    // `slice(7)` tira o "Bearer ". Mandar a string inteira faria toda
    // verificação falhar, e o sintoma seria "token inválido" em tudo.
    const verificar = jest.fn().mockResolvedValue(PAYLOAD);
    await guard(verificar).canActivate(
      contexto({ headers: { authorization: "Bearer abc.def.ghi" } }),
    );

    expect(verificar).toHaveBeenCalledWith("abc.def.ghi");
  });

  it("recusa sem cabeçalho de autorização", async () => {
    const verificar = jest.fn();
    await expect(
      guard(verificar).canActivate(contexto({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
    // Não chega a verificar nada: sem cabeçalho não há o que verificar, e
    // chamar o verificador com `undefined` só trocaria a mensagem por uma
    // pior.
    expect(verificar).not.toHaveBeenCalled();
  });

  it("recusa esquema diferente de Bearer", async () => {
    // `Basic` carrega usuário e senha em base64. Aceitá-lo aqui faria o
    // guarda tentar verificar credencial como se fosse token.
    const verificar = jest.fn();
    await expect(
      guard(verificar).canActivate(
        contexto({ headers: { authorization: "Basic dXNlcjpzZW5oYQ==" } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(verificar).not.toHaveBeenCalled();
  });

  it("recusa o token nu, sem esquema", async () => {
    const verificar = jest.fn();
    await expect(
      guard(verificar).canActivate(
        contexto({ headers: { authorization: "abc.def.ghi" } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("não aceita o esquema em caixa trocada", async () => {
    // `startsWith("Bearer ")` é sensível à caixa, e este teste prende essa
    // escolha: quem trocar por comparação frouxa passa a aceitar variações
    // que o emissor nunca emite.
    const verificar = jest.fn();
    await expect(
      guard(verificar).canActivate(
        contexto({ headers: { authorization: "bearer abc" } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("distingue token ausente de token inválido na mensagem", async () => {
    // São problemas diferentes para quem integra: um é cliente que esqueceu
    // de mandar, outro é sessão expirada. Uma mensagem só para os dois faria
    // o segundo caso parecer defeito do cliente.
    const semCabecalho = guard(jest.fn())
      .canActivate(contexto({ headers: {} }))
      .catch((e: Error) => e.message);
    const tokenRuim = guard(jest.fn().mockRejectedValue(new Error("jwt expired")))
      .canActivate(contexto({ headers: { authorization: "Bearer velho" } }))
      .catch((e: Error) => e.message);

    await expect(semCabecalho).resolves.toMatch(/ausente/i);
    await expect(tokenRuim).resolves.toMatch(/inválido ou expirado/i);
  });

  it("token expirado ou assinatura errada vira 401, e não 500", async () => {
    // O `verifyAsync` estoura para assinatura inválida e para expiração. Sem
    // o `catch`, a falha subiria como erro interno — o cliente leria "erro do
    // servidor" quando o problema é a sessão dele.
    const verificar = jest.fn().mockRejectedValue(new Error("invalid signature"));
    const req: Requisicao = { headers: { authorization: "Bearer forjado" } };

    await expect(guard(verificar).canActivate(contexto(req))).rejects.toThrow(
      UnauthorizedException,
    );
    // E não deixa rastro de usuário numa requisição recusada.
    expect(req.user).toBeUndefined();
  });

  it("não vaza o motivo interno da falha do verificador", async () => {
    // "jwt malformed" e "invalid signature" dizem ao atacante em que etapa
    // ele errou. A mensagem devolvida é sempre a mesma.
    const verificar = jest.fn().mockRejectedValue(new Error("jwt malformed"));
    const erro = await guard(verificar)
      .canActivate(contexto({ headers: { authorization: "Bearer x" } }))
      .catch((e: Error) => e.message);

    expect(erro).not.toMatch(/malformed/i);
    expect(erro).toBe("Token inválido ou expirado.");
  });
});
