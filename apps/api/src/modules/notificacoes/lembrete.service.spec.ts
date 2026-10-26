// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotificacaoTipo, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { LembreteService } from "./lembrete.service";
import { NotificacoesService } from "./notificacoes.service";

/** Sexta, 16/10/2026, 15:00 em São Paulo (UTC-3). */
const AGORA = new Date("2026-10-16T18:00:00.000Z");
const HORA = 60 * 60 * 1000;

function reserva(extras: Record<string, unknown> = {}) {
  return {
    id: "r1",
    // 19h local, duas horas à frente.
    inicio: new Date(AGORA.getTime() + 2 * HORA),
    clienteId: "u1",
    quadra: {
      nome: "Quadra 1",
      estabelecimento: {
        nome: "Arena Beira-Rio",
        timezone: "America/Sao_Paulo",
      },
    },
    ...extras,
  };
}

function servico(opcoes: { candidatas?: unknown[]; marcadas?: number[] } = {}) {
  const marcadas = [...(opcoes.marcadas ?? [])];
  const marcar = jest.fn(async () => ({
    // Permite simular quem perde a corrida pela marcação.
    count: marcadas.length > 0 ? (marcadas.shift() ?? 1) : 1,
  }));
  const buscar = jest.fn().mockResolvedValue(opcoes.candidatas ?? [reserva()]);
  const registrar = jest.fn().mockResolvedValue(undefined);

  const prisma = {
    reserva: { findMany: buscar, updateMany: marcar },
  } as unknown as PrismaService & Record<string, never>;

  return {
    servico: new LembreteService(prisma, {
      registrar,
    } as unknown as NotificacoesService),
    buscar,
    marcar,
    registrar,
  };
}

describe("LembreteService (RF-17)", () => {
  it("procura só o que ainda não foi avisado, na janela de três horas", async () => {
    const { servico: s, buscar } = servico();
    await s.enviarPendentes(AGORA);

    const onde = buscar.mock.calls[0][0].where;
    expect(onde.status).toBe(ReservaStatus.CONFIRMADA);
    expect(onde.lembreteEnviadoEm).toBeNull();
    expect(onde.inicio.gt).toEqual(AGORA);
    expect(onde.inicio.lte).toEqual(new Date(AGORA.getTime() + 3 * HORA));
  });

  it("não lembra reserva sem pagamento confirmado", async () => {
    // Lembrar de um jogo não pago seria cobrança disfarçada de lembrete, e
    // o aviso de pagamento pendente é outro assunto, com outro texto.
    const { servico: s, buscar } = servico();
    await s.enviarPendentes(AGORA);

    expect(buscar.mock.calls[0][0].where.status).toBe(ReservaStatus.CONFIRMADA);
  });

  it("não lembra reserva de balcão, que não tem a quem avisar", async () => {
    const { servico: s, buscar } = servico();
    await s.enviarPendentes(AGORA);

    expect(buscar.mock.calls[0][0].where.clienteId).toEqual({ not: null });
  });

  it("marca o envio antes de avisar", async () => {
    // A ordem é o que impede o mesmo aviso de sair de dez em dez minutos
    // durante três horas.
    const ordem: string[] = [];
    const { servico: s, marcar, registrar } = servico();
    marcar.mockImplementation(async () => {
      ordem.push("marcou");
      return { count: 1 };
    });
    registrar.mockImplementation(async () => {
      ordem.push("avisou");
    });

    await s.enviarPendentes(AGORA);
    expect(ordem).toEqual(["marcou", "avisou"]);
  });

  it("quem perde a corrida pela marcação não avisa", async () => {
    // Duas passagens que se sobreponham leem a mesma reserva; só uma sai
    // com `count: 1`.
    const { servico: s, registrar } = servico({ marcadas: [0] });

    await expect(s.enviarPendentes(AGORA)).resolves.toBe(0);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("o aviso leva a hora no fuso da arena, não no do servidor", async () => {
    // 18:00 UTC são 15:00 em São Paulo; o jogo às 20:00 UTC é às 17:00 lá.
    const { servico: s, registrar } = servico();
    await s.enviarPendentes(AGORA);

    const aviso = registrar.mock.calls[0][0];
    expect(aviso.titulo).toBe("Seu jogo é às 17:00");
    expect(aviso.tipo).toBe(NotificacaoTipo.LEMBRETE);
    expect(aviso.corpo).toBe("Arena Beira-Rio · Quadra 1");
  });

  it("o lembrete sai também por e-mail, com local e quadra", async () => {
    const { servico: s, registrar } = servico();
    await s.enviarPendentes(AGORA);

    const { email } = registrar.mock.calls[0][0];
    expect(email.assunto).toMatch(/lembrete/i);
    expect(email.texto).toContain("Arena Beira-Rio");
    expect(email.texto).toContain("Quadra 1");
  });

  it("leva ao comprovante da reserva, e não a uma lista", async () => {
    const { servico: s, registrar } = servico();
    await s.enviarPendentes(AGORA);

    expect(registrar.mock.calls[0][0].destino).toBe("/reservas/r1/confirmacao");
  });

  it("avisa cada reserva uma vez e conta quantas saíram", async () => {
    const { servico: s, registrar } = servico({
      candidatas: [reserva(), reserva({ id: "r2", clienteId: "u2" })],
    });

    await expect(s.enviarPendentes(AGORA)).resolves.toBe(2);
    expect(registrar).toHaveBeenCalledTimes(2);
  });

  it("sem candidata, não avisa ninguém e devolve zero", async () => {
    const { servico: s, registrar } = servico({ candidatas: [] });

    await expect(s.enviarPendentes(AGORA)).resolves.toBe(0);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("sem instante informado, usa o relógio — que é como o job chama", async () => {
    // O job não passa `agora`; se o padrão não valesse, a janela sairia a
    // partir da época e nenhuma reserva entraria nela.
    const { servico: s, buscar } = servico({ candidatas: [] });
    const antes = Date.now();

    await s.enviarPendentes();

    const { gt, lte } = buscar.mock.calls[0][0].where.inicio;
    expect(gt.getTime()).toBeGreaterThanOrEqual(antes);
    expect(lte.getTime() - gt.getTime()).toBe(3 * HORA);
  });

  it("limita quantas avisa por passagem", async () => {
    // Uma arena que confirma trezentas reservas de uma vez não deve virar
    // trezentos envios num tique só.
    const { servico: s, buscar } = servico();
    await s.enviarPendentes(AGORA);

    expect(buscar.mock.calls[0][0].take).toBe(200);
  });
});
