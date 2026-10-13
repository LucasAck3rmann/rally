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
      service.register({ nome: "Ana", email: "x@y.com", senha: "123456" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("o cadastro dispara a verificação de e-mail (RF-03)", async () => {
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({ nome: "Ana", email: "x@y.com", senha: "123456" });

    expect(enviarVerificacao).toHaveBeenCalledWith("u1", "Ana", "x@y.com");
  });

  it("e-mail já cadastrado não dispara verificação nenhuma", async () => {
    findUnique.mockResolvedValueOnce({ id: "1" });

    await expect(
      service.register({ nome: "Ana", email: "x@y.com", senha: "123456" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(enviarVerificacao).not.toHaveBeenCalled();
  });
});
