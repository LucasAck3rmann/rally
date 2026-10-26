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
 * Autentica o gateway de pagamento por segredo compartilhado.
 *
 * Mesma forma do `SegredoDeIngestaoGuard`, e pela mesma razão: quem chama é
 * **uma máquina do fornecedor**, não um usuário — ela não tem conta, não faz
 * login e não tem sessão para expirar. JWT aqui exigiria emitir credencial
 * para um terceiro, o que é mais superfície e não menos.
 *
 * Sem `ABACATEPAY_WEBHOOK_SECRET` configurado a rota responde **503 e não
 * 401**: a diferença importa porque 401 diria "seu segredo está errado"
 * quando o problema é que o servidor não tem segredo nenhum. E aceitar
 * qualquer chamada na ausência de configuração abriria **a confirmação de
 * pagamento** para a internet — aqui o custo do erro é maior que na
 * ingestão de replay, porque quem chamasse confirmaria reservas de graça.
 *
 * A variável já existia no `.env.example` desde setembro, sem nada que a
 * lesse. É o mesmo padrão que a trilha de auditoria tinha: preparado no
 * papel, ausente no sistema.
 */
@Injectable()
export class SegredoDeWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esperado = this.config.get<string>("ABACATEPAY_WEBHOOK_SECRET");
    if (!esperado) {
      throw new ServiceUnavailableException("Webhook de pagamento não configurado neste ambiente.");
    }

    const req = contexto.switchToHttp().getRequest<Request>();
    const recebido = req.header("x-rally-webhook-secret");
    if (!recebido || !segredosIguais(recebido, esperado)) {
      throw new UnauthorizedException("Segredo de webhook inválido.");
    }
    return true;
  }
}
