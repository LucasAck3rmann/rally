import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const jwt = { signAsync: jest.fn() } as unknown as JwtService;
  const findUnique = jest.fn();
  const prisma = {
    usuario: { findUnique, create: jest.fn() },
  } as unknown as PrismaService;
  const service = new AuthService(prisma, jwt);

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
});
