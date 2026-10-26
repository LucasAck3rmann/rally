// SPDX-License-Identifier: AGPL-3.0-or-later
import { PromocaoTipo } from "@prisma/client";

import { contaDaReserva, descontoDoCupom, motivoDaRecusa, type CupomParaAplicar } from "./cupom";

const AGORA = new Date("2026-10-13T18:00:00.000Z");

function cupom(parcial: Partial<CupomParaAplicar> = {}): CupomParaAplicar {
  return {
    codigo: "PRIMEIRA10",
    tipo: PromocaoTipo.PERCENTUAL,
    valor: 10,
    validadeInicio: new Date("2026-10-01T00:00:00.000Z"),
    validadeFim: new Date("2026-10-31T23:59:59.000Z"),
    usosMax: null,
    usosFeitos: 0,
    ativo: true,
    ...parcial,
  };
}

describe("validade do cupom (RN-14)", () => {
  it("cupom no ar e dentro da validade passa", () => {
    expect(motivoDaRecusa(cupom(), AGORA)).toBeNull();
  });

  it("cada recusa diz o que aconteceu, e não 'inválido'", () => {
    // "Esse cupom venceu" e "esse cupom acabou" levam a ações diferentes;
    // um "cupom inválido" genérico não leva a nenhuma.
    expect(motivoDaRecusa(cupom({ ativo: false }), AGORA)).toMatch(/não está mais disponível/i);
    expect(
      motivoDaRecusa(cupom({ validadeInicio: new Date("2026-11-01T00:00:00.000Z") }), AGORA),
    ).toMatch(/ainda não começou/i);
    expect(
      motivoDaRecusa(cupom({ validadeFim: new Date("2026-10-12T23:59:59.000Z") }), AGORA),
    ).toMatch(/venceu/i);
    expect(motivoDaRecusa(cupom({ usosMax: 50, usosFeitos: 50 }), AGORA)).toMatch(
      /limite de usos/i,
    );
  });

  it("sem limite de usos, uso nenhum esgota", () => {
    expect(motivoDaRecusa(cupom({ usosMax: null, usosFeitos: 9999 }), AGORA)).toBeNull();
  });
});

describe("desconto do cupom", () => {
  it("percentual incide sobre o preço", () => {
    expect(descontoDoCupom(cupom({ valor: 10 }), 80)).toBe(8);
  });

  it("valor fixo é o próprio valor", () => {
    expect(descontoDoCupom(cupom({ tipo: PromocaoTipo.VALOR_FIXO, valor: 25 }), 80)).toBe(25);
  });

  it("nunca passa do preço — cupom não vira crédito", () => {
    // R$ 100 de desconto numa quadra de R$ 80 zera a conta; devolver −20
    // faria a arena dever dinheiro a quem reservou.
    expect(descontoDoCupom(cupom({ tipo: PromocaoTipo.VALOR_FIXO, valor: 100 }), 80)).toBe(80);
  });
});

describe("conta da reserva: cupom × desconto do Pix", () => {
  it("sem cupom, vale o desconto do Pix", () => {
    const { valor, desconto } = contaDaReserva({
      precoBruto: 80,
      descontoPixPct: 5,
      acumulam: false,
    });

    expect(valor).toBe(76);
    expect(desconto).toEqual({ origem: "pix", valor: 4 });
  });

  it("sem cupom e sem desconto, não inventa desconto nenhum", () => {
    const { valor, desconto } = contaDaReserva({
      precoBruto: 80,
      descontoPixPct: 0,
      acumulam: false,
    });

    expect(valor).toBe(80);
    expect(desconto).toEqual({ origem: "nenhum" });
  });

  it("os dois não somam: vale o maior", () => {
    // Cupom de 10% contra Pix de 5%, numa quadra de R$ 80.
    const { valor, desconto } = contaDaReserva({
      precoBruto: 80,
      descontoPixPct: 5,
      cupom: cupom({ valor: 10 }),
      acumulam: false,
    });

    expect(valor).toBe(72);
    expect(desconto).toEqual({ origem: "cupom", valor: 8, codigo: "PRIMEIRA10" });
  });

  it("cupom pior que o Pix não faz o cliente pagar mais", () => {
    // É a decisão que este arquivo existe para proteger. Deixar o cupom
    // ganhar sempre faria quem digita um cupom de 5% numa arena com 10% no
    // Pix pagar mais **por ter usado o cupom**. Ninguém escreve promoção
    // para punir quem a usa.
    const { valor, desconto } = contaDaReserva({
      precoBruto: 80,
      descontoPixPct: 10,
      cupom: cupom({ valor: 5 }),
      acumulam: false,
    });

    expect(valor).toBe(72);
    expect(desconto).toEqual({ origem: "pix", valor: 8 });
  });

  it("configurado para acumular, o cupom incide sobre o preço já com Pix", () => {
    // Somar os dois percentuais sobre o bruto daria 15% — mais do que
    // qualquer um dos dois significa isoladamente. Aqui é 10% sobre R$ 76.
    const { valor, desconto } = contaDaReserva({
      precoBruto: 80,
      descontoPixPct: 5,
      cupom: cupom({ valor: 10 }),
      acumulam: true,
    });

    expect(valor).toBe(68.4);
    expect(desconto).toEqual({
      origem: "pix+cupom",
      valor: 11.6,
      codigo: "PRIMEIRA10",
    });
  });

  it("empate entre cupom e Pix fica com o cupom, que é o que o cliente pediu", () => {
    const { desconto } = contaDaReserva({
      precoBruto: 80,
      descontoPixPct: 10,
      cupom: cupom({ valor: 10 }),
      acumulam: false,
    });

    expect(desconto).toEqual({ origem: "cupom", valor: 8, codigo: "PRIMEIRA10" });
  });

  it("arredonda em duas casas, porque é dinheiro", () => {
    const { valor } = contaDaReserva({
      precoBruto: 83.33,
      descontoPixPct: 7,
      acumulam: false,
    });

    expect(valor).toBe(77.5);
    expect(Number.isInteger(valor * 100)).toBe(true);
  });
});
