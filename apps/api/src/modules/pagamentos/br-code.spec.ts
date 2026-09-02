// SPDX-License-Identifier: AGPL-3.0-or-later
import { montarBrCode } from "./br-code";

describe("montarBrCode", () => {
  const payload = montarBrCode({
    chave: "rally-dev@exemplo.com",
    valor: 76,
    nomeRecebedor: "Rally Areia Ltda",
    cidade: "Sapiranga",
    identificador: "abc123",
  });

  it("abre com o indicador de versão e o merchant do Pix", () => {
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("br.gov.bcb.pix");
  });

  it("leva o valor em reais com duas casas", () => {
    expect(payload).toContain("540576.00");
  });

  it("fecha com um CRC-16/CCITT válido de 4 dígitos", () => {
    const semCrc = payload.slice(0, -4);
    const crc = payload.slice(-4);
    expect(semCrc.endsWith("6304")).toBe(true);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);

    let calculado = 0xffff;
    for (const caractere of semCrc) {
      calculado ^= caractere.charCodeAt(0) << 8;
      for (let bit = 0; bit < 8; bit++) {
        calculado =
          calculado & 0x8000 ? ((calculado << 1) ^ 0x1021) & 0xffff : (calculado << 1) & 0xffff;
      }
    }
    expect(crc).toBe(calculado.toString(16).toUpperCase().padStart(4, "0"));
  });

  it("remove acentos do nome e da cidade", () => {
    const comAcento = montarBrCode({
      chave: "x@y.com",
      valor: 10,
      nomeRecebedor: "Areião Esportes",
      cidade: "São Paulo",
      identificador: "1",
    });
    expect(comAcento).toContain("Areiao Esportes");
    expect(comAcento).toContain("Sao Paulo");
  });
});
