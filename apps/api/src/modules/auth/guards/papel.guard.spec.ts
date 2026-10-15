// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { PapelGuard } from "./papel.guard";

type Requisicao = {
  user?: { sub: string; email: string };
  params?: Record<string, string>;
  vinculo?: unknown;
};

function contexto(req: Requisicao): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guard(vinculo: unknown, papeisExigidos?: Role[]) {
  const prisma = {
    membership: { findUnique: jest.fn().mockResolvedValue(vinculo) },
  } as unknown as PrismaService;

  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(papeisExigidos),
  } as unknown as Reflector;

  return new PapelGuard(reflector, prisma);
}

const USUARIO = { sub: "u1", email: "dono@arena.com" };
const PARAMS = { estabelecimentoId: "e1" };

describe("PapelGuard", () => {
  it("libera e anexa o vínculo quando o papel serve", async () => {
    const req: Requisicao = { user: USUARIO, params: PARAMS };
    const vinculo = { id: "m1", role: Role.ADMIN, estabelecimentoId: "e1" };

    await expect(guard(vinculo).canActivate(contexto(req))).resolves.toBe(true);
    expect(req.vinculo).toEqual(vinculo);
  });

  it("aceita qualquer papel de gestão quando a rota não exige um específico", async () => {
    for (const role of [Role.ADMIN, Role.ATENDENTE, Role.FINANCEIRO]) {
      const req: Requisicao = { user: USUARIO, params: PARAMS };
      const vinculo = { id: "m1", role, estabelecimentoId: "e1" };
      await expect(guard(vinculo).canActivate(contexto(req))).resolves.toBe(
        true,
      );
    }
  });

  it("responde 404 — não 403 — para quem não tem vínculo nenhum", async () => {
    // Quem não participa do estabelecimento não deve nem descobrir que ele
    // existe: 403 confirmaria a existência do recurso (IDOR).
    const req: Requisicao = { user: USUARIO, params: PARAMS };
    await expect(guard(null).canActivate(contexto(req))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("trata o vínculo de cliente como se não existisse", async () => {
    const req: Requisicao = { user: USUARIO, params: PARAMS };
    const vinculo = { id: "m1", role: Role.CLIENTE, estabelecimentoId: "e1" };
    await expect(
      guard(vinculo).canActivate(contexto(req)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("recusa com 403 quem é da casa mas não tem o papel exigido", async () => {
    const req: Requisicao = { user: USUARIO, params: PARAMS };
    const vinculo = { id: "m1", role: Role.ATENDENTE, estabelecimentoId: "e1" };
    await expect(
      guard(vinculo, [Role.ADMIN]).canActivate(contexto(req)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("não deixa passar o mantenedor da plataforma pela porta do tenant", async () => {
    const req: Requisicao = { user: USUARIO, params: PARAMS };
    const vinculo = {
      id: "m1",
      role: Role.MANTENEDOR,
      estabelecimentoId: "e1",
    };
    await expect(
      guard(vinculo).canActivate(contexto(req)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("exige sessão", async () => {
    const req: Requisicao = { params: PARAMS };
    await expect(
      guard(null).canActivate(contexto(req)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("acusa rota mal configurada, sem o parâmetro do estabelecimento", async () => {
    const req: Requisicao = { user: USUARIO, params: {} };
    await expect(
      guard(null).canActivate(contexto(req)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("consulta o vínculo pelo par usuário × estabelecimento", async () => {
    const prisma = {
      membership: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "m1", role: Role.ADMIN, estabelecimentoId: "e1" }),
      },
    } as unknown as PrismaService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    await new PapelGuard(reflector, prisma).canActivate(
      contexto({ user: USUARIO, params: PARAMS }),
    );

    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId_estabelecimentoId: {
            usuarioId: "u1",
            estabelecimentoId: "e1",
          },
        },
      }),
    );
  });
});
