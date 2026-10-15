// SPDX-License-Identifier: AGPL-3.0-or-later
import { PainelController } from "./painel.controller";
import { PainelService } from "./painel.service";

/**
 * **A conversão do período do painel (RF-22).**
 *
 * É o único controlador do projeto que **transforma** a entrada em vez de
 * repassá-la, e era o único com 0% de cobertura de ramos — o ramo em questão
 * sendo o valor padrão de sete dias.
 *
 * O que estes testes protegem não é o `Number()`: é a diferença entre
 * **recusar** e **adivinhar**. `Number("abc")` é `NaN`, e o serviço recusa
 * `NaN` com 400 porque `Number.isInteger(NaN)` é falso. Quem "simplificasse"
 * isto para `Number(dias) || 7` trocaria aquele 400 por um silencioso
 * período de sete dias — e o dono veria um painel de uma semana acreditando
 * estar vendo o período que pediu. Número errado apresentado como certo é
 * pior que erro, e esta suíte é o que impede a simplificação.
 */

function controlador() {
  const resumo = jest.fn().mockResolvedValue({ ocupacao: null });
  return {
    c: new PainelController({ resumo } as unknown as PainelService),
    resumo,
  };
}

describe("PainelController", () => {
  it("sem o parâmetro, pede sete dias — a semana que está acontecendo", async () => {
    const { c, resumo } = controlador();
    await c.resumo("e1");
    expect(resumo).toHaveBeenCalledWith("e1", 7);
  });

  it("converte o texto da consulta em número", async () => {
    // Query string é sempre texto: sem a conversão, o serviço compararia
    // `"30" < 1` e `Number.isInteger("30")` seria falso — todo período
    // explícito viraria 400.
    const { c, resumo } = controlador();
    await c.resumo("e1", "30");
    expect(resumo).toHaveBeenCalledWith("e1", 30);
  });

  it("texto que não é número chega como NaN, para o serviço recusar", async () => {
    // **A asserção que mais importa deste arquivo.** O controlador não
    // adivinha: ele entrega `NaN`, e o serviço responde 400 dizendo que o
    // período vai de 1 a 90. Trocar isto por um padrão silencioso faria o
    // painel mentir sobre o próprio período.
    const { c, resumo } = controlador();
    await c.resumo("e1", "abc");

    const [, dias] = resumo.mock.calls[0];
    expect(Number.isNaN(dias)).toBe(true);
  });

  it("string vazia também não vira o padrão", async () => {
    // `?dias=` dá string vazia, e `Number("")` é zero — que o serviço recusa,
    // porque zero dia não é período. Com `|| 7` viraria sete em silêncio.
    const { c, resumo } = controlador();
    await c.resumo("e1", "");
    expect(resumo).toHaveBeenCalledWith("e1", 0);
  });

  it("não interpreta o período fora da faixa — isso é do serviço", async () => {
    // O controlador converte, o serviço valida a faixa. Repetir a validação
    // aqui criaria duas verdades para desalinhar, e a mensagem que o usuário
    // lê viria de dois lugares.
    const { c, resumo } = controlador();
    await c.resumo("e1", "9999");
    expect(resumo).toHaveBeenCalledWith("e1", 9999);
  });

  it("repassa o estabelecimento da rota, e não outro", async () => {
    const { c, resumo } = controlador();
    await c.resumo("e-da-rota", "7");
    expect(resumo.mock.calls[0][0]).toBe("e-da-rota");
  });
});
