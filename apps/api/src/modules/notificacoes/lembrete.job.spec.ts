// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

import { LembreteDeJogoJob } from "./lembrete.job";
import { LembreteService } from "./lembrete.service";

function job(
  opcoes: { ambiente?: string; enviados?: number; erro?: unknown } = {},
) {
  const lembretes = {
    enviarPendentes: opcoes.erro
      ? jest.fn().mockRejectedValue(opcoes.erro)
      : jest.fn().mockResolvedValue(opcoes.enviados ?? 0),
  };
  const config = {
    get: jest.fn().mockReturnValue(opcoes.ambiente ?? "development"),
  };

  return {
    job: new LembreteDeJogoJob(
      lembretes as unknown as LembreteService,
      config as unknown as ConfigService,
    ),
    lembretes,
  };
}

describe("LembreteDeJogoJob (RF-17)", () => {
  it("não roda em ambiente de teste", async () => {
    // Uma suíte que levante o módulo inteiro começaria a escrever no banco
    // sem ninguém pedir.
    const { job: j, lembretes } = job({ ambiente: "test" });
    await j.executar();

    expect(lembretes.enviarPendentes).not.toHaveBeenCalled();
  });

  it("falha de banco não derruba o processo", async () => {
    // Um job que estoura mata o processo em algumas configurações do Node.
    // Falha aqui é temporária: registra e tenta na próxima volta.
    const erro = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    const { job: j } = job({ erro: new Error("conexão caiu") });

    await expect(j.executar()).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalledWith(
      expect.stringContaining("Falha ao enviar lembretes"),
    );
    erro.mockRestore();
  });

  it("não registra nada quando não havia o que avisar", async () => {
    // O job roda de dez em dez minutos; uma linha por passagem afogaria o
    // registro de qualquer coisa que importe.
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ enviados: 0 });

    await j.executar();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("registra quando avisou alguém", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ enviados: 4 });

    await j.executar();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("4 lembrete(s)"));
    log.mockRestore();
  });
});
