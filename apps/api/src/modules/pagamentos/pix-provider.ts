// SPDX-License-Identifier: AGPL-3.0-or-later

/** Cobrança Pix devolvida pelo provedor de pagamento. */
export interface CobrancaPix {
  /** Identificador da cobrança no gateway (para casar o webhook). */
  gatewayId: string;
  /** Payload "copia e cola" (BR Code EMV). */
  copiaCola: string;
  /** URL da imagem do QR, quando o gateway fornece uma. */
  qrCodeUrl: string | null;
  expiraEm: Date;
}

export interface CriarCobrancaPix {
  reservaId: string;
  valor: number;
  descricao: string;
  expiraEmMinutos: number;
}

/**
 * Porta de pagamento Pix. A implementação de produção é a **AbacatePay**
 * (ver ADR de pagamentos); em desenvolvimento usamos {@link PIX_PROVIDER}
 * com o provedor local, para o fluxo do app rodar ponta a ponta sem gateway.
 */
export interface PixProvider {
  criarCobranca(input: CriarCobrancaPix): Promise<CobrancaPix>;
}

export const PIX_PROVIDER = Symbol("PIX_PROVIDER");
