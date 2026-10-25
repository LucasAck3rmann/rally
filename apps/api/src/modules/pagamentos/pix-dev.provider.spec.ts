// SPDX-License-Identifier: AGPL-3.0-or-later
import { Logger } from "@nestjs/common";

import { PixDevProvider } from "./pix-dev.provider";

/**
 * O provedor Pix de desenvolvimento (ADR-0003).
 *
 * Não movimenta dinheiro, e é justamente por isso que ele merece teste: é
 * ele que o checkout do aplicativo usa enquanto a AbacatePay não entra, e um
 * BR Code malformado aqui aparece como QR que não lê — no aparelho, longe
 * daqui.
 *
 * As regras do BR Code em si moram no `br-code.spec.ts`. O que está sob
 * teste aqui é a **ligação**: que chave entra, de onde sai o identificador e
 * quando a cobrança vence.
 */
describe("PixDevProvider", () => {
  const provider = new PixDevProvider();
  const pedido = {
    reservaId: "cmveoyxbb0003vwak9m4ksa5q",
    valor: 76,
    descricao: "Quadra 1 — 20/10 às 19h",
    expiraEmMinutos: 30,
  };

  beforeEach(() => jest.clearAllMocks());

  it("avisa no log que a cobrança é simulada", async () => {
    // O aviso é o que impede alguém de olhar um ambiente e achar que há
    // gateway atrás.
    const aviso = jest.spyOn(Logger.prototype, "warn").mockImplementation();

    await provider.criarCobranca(pedido);

    expect(String(aviso.mock.calls[0][0])).toMatch(/simulada/i);
    aviso.mockRestore();
  });

  it("o identificador do gateway diz que é de desenvolvimento", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const cobranca = await provider.criarCobranca(pedido);
    expect(cobranca.gatewayId).toMatch(/^dev_/);
  });

  it("não devolve URL de QR: o aplicativo desenha a partir do copia e cola", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const cobranca = await provider.criarCobranca(pedido);

    expect(cobranca.qrCodeUrl).toBeNull();
    expect(cobranca.copiaCola.startsWith("000201")).toBe(true);
  });

  it("o vencimento sai do prazo pedido, e não de um padrão escondido", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const antes = Date.now();

    const cobranca = await provider.criarCobranca(pedido);

    const minutos = (cobranca.expiraEm.getTime() - antes) / 60_000;
    expect(minutos).toBeGreaterThan(29.9);
    expect(minutos).toBeLessThan(30.2);
  });

  /**
   * A chave vem do ambiente quando há uma, e cai num endereço de exemplo
   * quando não há. Os dois lados importam: sem o padrão, um ambiente de
   * desenvolvimento recém-clonado geraria BR Code com `undefined` dentro.
   */
  it("usa a chave do ambiente quando existe", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const anterior = process.env.PIX_CHAVE_DEV;
    process.env.PIX_CHAVE_DEV = "chave-do-ambiente@rally.app";

    const cobranca = await provider.criarCobranca(pedido);

    expect(cobranca.copiaCola).toContain("chave-do-ambiente@rally.app");
    if (anterior === undefined) delete process.env.PIX_CHAVE_DEV;
    else process.env.PIX_CHAVE_DEV = anterior;
  });

  it("sem chave no ambiente, cai no endereço de exemplo", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const anterior = process.env.PIX_CHAVE_DEV;
    delete process.env.PIX_CHAVE_DEV;

    const cobranca = await provider.criarCobranca(pedido);

    expect(cobranca.copiaCola).toContain("rally-dev@exemplo.com");
    if (anterior !== undefined) process.env.PIX_CHAVE_DEV = anterior;
  });
});
