// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  PAPEIS_DE_GESTAO,
  PAPEIS_EXIGIDOS,
} from "../decorators/papeis.decorator";
import { JwtPayload } from "../types/jwt-payload";
import { RequisicaoDeGestao } from "../types/requisicao-de-gestao";

/**
 * Autorização por papel **dentro de um estabelecimento** (RF-02).
 *
 * O tenant vem do parâmetro `:estabelecimentoId` da rota, e o papel vem do
 * `Membership` do usuário naquele estabelecimento — não do token. Assim o
 * isolamento do ADR-0011 é decidido num lugar só, e um JWT roubado não vira
 * acesso a outro tenant.
 *
 * Roda **depois** do `JwtAuthGuard`, que é quem popula `req.user`.
 */
@Injectable()
export class PapelGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto
      .switchToHttp()
      .getRequest<RequisicaoDeGestao & { user?: JwtPayload }>();

    if (!req.user) {
      throw new UnauthorizedException("Sessão ausente.");
    }

    // O Express tipa cada parâmetro como `string | string[]`; aqui só faz
    // sentido um valor único, e o que não for isso é rota mal configurada.
    const estabelecimentoId = req.params?.estabelecimentoId;
    if (typeof estabelecimentoId !== "string" || estabelecimentoId === "") {
      throw new BadRequestException("Estabelecimento não informado na rota.");
    }

    const vinculo = await this.prisma.membership.findUnique({
      where: {
        usuarioId_estabelecimentoId: {
          usuarioId: req.user.sub,
          estabelecimentoId,
        },
      },
      select: { id: true, role: true, estabelecimentoId: true },
    });

    // Sem vínculo o usuário recebe 404, não 403: quem não participa do
    // estabelecimento não deve nem confirmar que ele existe (IDOR).
    if (!vinculo || vinculo.role === Role.CLIENTE) {
      throw new NotFoundException("Estabelecimento não encontrado.");
    }

    const exigidos =
      this.reflector.getAllAndOverride<Role[]>(PAPEIS_EXIGIDOS, [
        contexto.getHandler(),
        contexto.getClass(),
      ]) ?? PAPEIS_DE_GESTAO;

    // Aqui já sabemos que ele é da casa — o 403 não vaza nada e é honesto.
    if (!exigidos.includes(vinculo.role)) {
      throw new ForbiddenException(
        "Seu papel não permite essa ação neste estabelecimento.",
      );
    }

    req.vinculo = vinculo;
    return true;
  }
}
