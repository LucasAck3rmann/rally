// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Montagem do **BR Code** (payload EMV® QRCPS-MPM) usado pelo Pix.
 * Referência: Manual de Padrões para Iniciação do Pix (Banco Central).
 */

/** Campo no formato ID + tamanho (2 dígitos) + valor. */
function campo(id: string, valor: string): string {
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** CRC-16/CCITT-FALSE, exigido no campo 63 do BR Code. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos e caracteres fora do conjunto aceito pelo BR Code. */
function sanitizar(texto: string, limite: number): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, limite);
}

export function montarBrCode(params: {
  chave: string;
  valor: number;
  nomeRecebedor: string;
  cidade: string;
  identificador: string;
}): string {
  const merchant = campo("00", "br.gov.bcb.pix") + campo("01", params.chave);

  const semCrc =
    campo("00", "01") +
    campo("26", merchant) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", params.valor.toFixed(2)) +
    campo("58", "BR") +
    campo("59", sanitizar(params.nomeRecebedor, 25)) +
    campo("60", sanitizar(params.cidade, 15)) +
    campo("62", campo("05", sanitizar(params.identificador, 25))) +
    "6304";

  return semCrc + crc16(semCrc);
}
