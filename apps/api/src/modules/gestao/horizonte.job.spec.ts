// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

import { HorizonteDeMensalistasJob } from "./horizonte.job";
import { RecorrenciasService } from "./recorrencias.service";

type Resultado = {
  series: number;
  criadas: number;
  puladas: number;
  falhas: number;
};

function job(
  opcoes: { ambiente?: string; resultado?: Partial<Resultado>; erro?: unknown } = {},
) {
  const resultado: Resultado = {
    series: 0,
    criadas: 0,
    puladas: 0,
    falhas: 0,
    ...opcoes.resultado,
  };
  const recorrencias = {
    estenderHorizonte: opcoes.erro
      ? jest.fn().mockRejectedValue(opcoes.erro)
      : jest.fn().mockResolvedValue(resultado),
  };
  const config = {
    get: jest.fn().mockReturnValue(opcoes.ambiente ?? "development"),
  };

  return {
    job: new HorizonteDeMensalistasJob(
      recorrencias as unknown as RecorrenciasService,
      config as unknown as ConfigService,
    ),
    recorrencias,
  };
}

describe("HorizonteDeMensalistasJob (RF-36, ADR-0014)", () => {
  it("varre a plataforma inteira, sem filtro de estabelecimento", async () => {
    // O horizonte é obrigação da plataforma, não de uma arena: se fosse por
    // estabelecimento, a arena que ninguém abriu hoje ficaria sem ocorrências.
    const { job: j, recorrencias } = job({ resultado: { series: 4, criadas: 9 } });
    await j.executar();

    expect(recorrencias.estenderHorizonte).toHaveBeenCalledTimes(1);
    expect(recorrencias.estenderHorizonte).toHaveBeenCalledWith();
  });

  it("não roda em ambiente de teste", async () => {
    // Uma suíte que levante o módulo inteiro começaria a escrever no banco
    // sem ninguém pedir.
    const { job: j, recorrencias } = job({ ambiente: "test" });
    await j.executar();

    expect(recorrencias.estenderHorizonte).not.toHaveBeenCalled();
  });

  it("falha de banco não derruba o processo", async () => {
    const erro = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const { job: j } = job({ erro: new Error("conexão caiu") });

    await expect(j.executar()).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalledWith(
      expect.stringContaining("Falha ao estender o horizonte"),
    );
    erro.mockRestore();
  });

  it("não registra nada quando não havia o que criar", async () => {
    // Uma linha diária de "0 séries" enterraria o dia em que algo der errado.
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ resultado: { series: 3 } });

    await j.executar();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("registra o que criou e em quantas séries", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ resultado: { series: 4, criadas: 7 } });

    await j.executar();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("7 ocorrência(s) criada(s) em 4 série(s)"),
    );
    log.mockRestore();
  });

  it("série com falha vira aviso, e o aviso diz a consequência", async () => {
    // **É a linha que alguém precisa ver.** Série que não materializou deixa
    // o horário aparecendo livre na grade **tendo dono** — e o aviso é o
    // único lugar onde isso é dito antes de o cliente chegar e encontrar a
    // quadra vendida para outro.
    const aviso = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ resultado: { series: 5, criadas: 4, falhas: 2 } });

    await j.executar();

    expect(aviso).toHaveBeenCalledWith(
      expect.stringContaining("2 série(s) não materializaram"),
    );
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("livre na grade"));
    aviso.mockRestore();
    log.mockRestore();
  });

  it("semana pulada sozinha já merece registro", async () => {
    // Pular semana é comportamento previsto do ADR-0014, não erro — mas é o
    // que explica um mensalista reclamando de um sábado que não existe.
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ resultado: { series: 2, puladas: 1 } });

    await j.executar();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("1 semana(s) pulada(s)"),
    );
    log.mockRestore();
  });
});
