// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

import { ConciliacaoService } from "./conciliacao.service";
import { ExpiracaoDePendentesJob } from "./expiracao.job";

function job(
  opcoes: { ambiente?: string; liberadas?: number; erro?: unknown } = {},
) {
  const conciliacao = {
    expirarPendentes: opcoes.erro
      ? jest.fn().mockRejectedValue(opcoes.erro)
      : jest.fn().mockResolvedValue(opcoes.liberadas ?? 0),
  };
  const config = {
    get: jest.fn().mockReturnValue(opcoes.ambiente ?? "development"),
  };

  return {
    job: new ExpiracaoDePendentesJob(
      conciliacao as unknown as ConciliacaoService,
      config as unknown as ConfigService,
    ),
    conciliacao,
  };
}

describe("ExpiracaoDePendentesJob (RN-13)", () => {
  it("varre todos os estabelecimentos, sem filtro", async () => {
    // Filtro vazio de propósito: o job é da plataforma, não de uma arena.
    const { job: j, conciliacao } = job({ liberadas: 3 });
    await j.executar();

    expect(conciliacao.expirarPendentes).toHaveBeenCalledWith({});
  });

  it("não roda em ambiente de teste", async () => {
    // Uma suíte que levante o módulo inteiro começaria a escrever no banco
    // sem ninguém pedir.
    const { job: j, conciliacao } = job({ ambiente: "test" });
    await j.executar();

    expect(conciliacao.expirarPendentes).not.toHaveBeenCalled();
  });

  it("falha de banco não derruba o processo", async () => {
    // Um job que estoura mata o processo em algumas configurações do Node.
    // Falha aqui é temporária: registra e tenta no próximo minuto.
    const erro = jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    const { job: j } = job({ erro: new Error("conexão caiu") });

    await expect(j.executar()).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalledWith(
      expect.stringContaining("Falha ao expirar pendentes"),
    );
    erro.mockRestore();
  });

  it("não registra nada quando não havia o que liberar", async () => {
    // O job roda a cada minuto; uma linha de log por minuto afogaria o
    // registro de qualquer coisa que importe.
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ liberadas: 0 });

    await j.executar();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("registra quando liberou algo", async () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    const { job: j } = job({ liberadas: 2 });

    await j.executar();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("2 horário(s)"));
    log.mockRestore();
  });
});
