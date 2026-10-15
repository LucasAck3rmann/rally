// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

import { segredosIguais } from "../../../common/segredo";

/**
 * Autentica o provedor de captação por segredo compartilhado.
 *
 * Não é JWT: quem chama é uma **máquina do parceiro**, não um usuário — ela
 * não tem conta, não faz login e não tem sessão para expirar.
 *
 * Sem `REPLAY_INGEST_SECRET` configurado a rota responde **503 e não 401**:
 * a diferença importa porque 401 diria "seu segredo está errado" quando o
 * problema é que o servidor não tem segredo nenhum. E aceitar qualquer
 * chamada na ausência de configuração abriria a ingestão para a internet.
 */
@Injectable()
export class SegredoDeIngestaoGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esperado = this.config.get<string>("REPLAY_INGEST_SECRET");
    if (!esperado) {
      throw new ServiceUnavailableException(
        "Ingestão de replay não configurada neste ambiente.",
      );
    }

    const req = contexto.switchToHttp().getRequest<Request>();
    const recebido = req.header("x-rally-ingest-secret");
    if (!recebido || !segredosIguais(recebido, esperado)) {
      throw new UnauthorizedException("Segredo de ingestão inválido.");
    }
    return true;
  }
}
