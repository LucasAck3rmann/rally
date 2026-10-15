// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { VerificacaoDeEmailService } from "./verificacao-de-email.service";

describe("AuthService", () => {
  const jwt = { signAsync: jest.fn() } as unknown as JwtService;
  const findUnique = jest.fn();
  const create = jest.fn();
  const prisma = {
    usuario: { findUnique, create },
  } as unknown as PrismaService;
  const enviarVerificacao = jest.fn().mockResolvedValue(undefined);
  const service = new AuthService(prisma, jwt, {
    enviar: enviarVerificacao,
  } as unknown as VerificacaoDeEmailService);

  beforeEach(() => jest.clearAllMocks());

  it("login rejeita credenciais inválidas (usuário inexistente)", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(
      service.login({ email: "x@y.com", senha: "123456" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("register rejeita e-mail já cadastrado", async () => {
    findUnique.mockResolvedValueOnce({ id: "1" });
    await expect(
      service.register({ nome: "Ana", email: "x@y.com", senha: "123456", aceitouTermos: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("o cadastro dispara a verificação de e-mail (RF-03)", async () => {
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({ nome: "Ana", email: "x@y.com", senha: "123456", aceitouTermos: true });

    expect(enviarVerificacao).toHaveBeenCalledWith("u1", "Ana", "x@y.com");
  });

  it("e-mail já cadastrado não dispara verificação nenhuma", async () => {
    findUnique.mockResolvedValueOnce({ id: "1" });

    await expect(
      service.register({ nome: "Ana", email: "x@y.com", senha: "123456", aceitouTermos: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(enviarVerificacao).not.toHaveBeenCalled();
  });

  it("registra quando o consentimento foi dado (RNF-07)", async () => {
    // A coluna existia desde junho e nunca era escrita: a política era
    // aceita na tela e o sistema não guardava prova nenhuma disso — o que é
    // o mesmo que não ter aceite.
    const antes = Date.now();
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({
      nome: "Ana",
      email: "x@y.com",
      senha: "123456",
      aceitouTermos: true,
    });

    const { consentLgpdEm } = create.mock.calls[0][0].data;
    expect(consentLgpdEm).toBeInstanceOf(Date);
    expect(consentLgpdEm.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("a senha vai como resumo, nunca em texto", async () => {
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({
      nome: "Ana",
      email: "x@y.com",
      senha: "123456",
      aceitouTermos: true,
    });

    expect(create.mock.calls[0][0].data.senhaHash).not.toBe("123456");
  });
});
