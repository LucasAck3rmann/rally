// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { montarBrCode } from "./br-code";
import { CobrancaPix, CriarCobrancaPix, PixProvider } from "./pix-provider";

/**
 * Provedor Pix **de desenvolvimento**: monta um BR Code bem-formado a partir de
 * uma chave de teste, para o fluxo de checkout do app rodar sem gateway.
 *
 * Não movimenta dinheiro e não recebe webhook — a confirmação em dev é feita
 * por `POST /pagamentos/:id/simular` (bloqueado fora de desenvolvimento).
 * Em produção, quem responde por esta porta é a integração com a AbacatePay.
 */
@Injectable()
export class PixDevProvider implements PixProvider {
  private readonly logger = new Logger(PixDevProvider.name);

  async criarCobranca(input: CriarCobrancaPix): Promise<CobrancaPix> {
    this.logger.warn(`Cobrança Pix simulada (sem gateway) para a reserva ${input.reservaId}.`);
    return {
      gatewayId: `dev_${randomUUID()}`,
      copiaCola: montarBrCode({
        chave: process.env.PIX_CHAVE_DEV ?? "rally-dev@exemplo.com",
        valor: input.valor,
        nomeRecebedor: "RALLY DEV",
        cidade: "SAPIRANGA",
        identificador: input.reservaId.slice(-12),
      }),
      qrCodeUrl: null, // o app desenha o QR a partir do copia e cola
      expiraEm: new Date(Date.now() + input.expiraEmMinutos * 60 * 1000),
    };
  }
}
