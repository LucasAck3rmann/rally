// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { VerificacaoDeEmailService } from "./verificacao-de-email.service";

const AGORA = new Date("2026-10-13T13:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

function servico(
  opcoes: {
    token?: unknown;
    jaUsadoNaCorrida?: boolean;
    erroAoEnviar?: unknown;
  } = {},
) {
  const criarToken = jest.fn().mockResolvedValue({ id: "t1" });
  const marcarUso = jest
    .fn()
    .mockResolvedValue({ count: opcoes.jaUsadoNaCorrida ? 0 : 1 });
  const marcarUsuario = jest.fn().mockResolvedValue({});
  const enviar = opcoes.erroAoEnviar
    ? jest.fn().mockRejectedValue(opcoes.erroAoEnviar)
    : jest.fn().mockResolvedValue(undefined);

  const prisma = {
    tokenDeEmail: {
      findUnique: jest.fn().mockResolvedValue(opcoes.token ?? null),
      updateMany: marcarUso,
      create: criarToken,
    },
    usuario: { update: marcarUsuario },
  } as unknown as PrismaService & Record<string, never>;

  const config = {
    get: jest.fn().mockReturnValue("https://rally.exemplo"),
  } as unknown as ConfigService;

  return {
    servico: new VerificacaoDeEmailService(prisma, config, { enviar }),
    criarToken,
    marcarUso,
    marcarUsuario,
    enviar,
  };
}

describe("VerificacaoDeEmailService.enviar (RF-03)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("guarda o hash do token, nunca o token", async () => {
    const { servico: s, criarToken, enviar } = servico();
    await s.enviar("u1", "Lucas", "lucas@exemplo.com");

    const link = (enviar.mock.calls[0][0].texto as string).match(
      /token=([^\s]+)/,
    )![1];
    expect(criarToken.mock.calls[0][0].data.tokenHash).toBe(
      createHash("sha256").update(link).digest("hex"),
    );
    expect(JSON.stringify(criarToken.mock.calls[0][0])).not.toContain(link);
  });

  it("o link vale sete dias, e não os trinta minutos do de senha", async () => {
    // A diferença é de consequência: o de senha troca credencial, este só
    // confirma um fato. Expirar em meia hora criaria fila de suporte para
    // quem abriu a caixa de entrada no dia seguinte, sem nada em troca.
    const { servico: s, criarToken, enviar } = servico();
    await s.enviar("u1", "Lucas", "lucas@exemplo.com");

    expect(criarToken.mock.calls[0][0].data.expiraEm).toEqual(
      new Date(AGORA.getTime() + 7 * DIA),
    );
    expect(enviar.mock.calls[0][0].texto).toContain("7 dias");
  });

  it("diz que a conta já está ativa, para ninguém ficar esperando", async () => {
    const { servico: s, enviar } = servico();
    await s.enviar("u1", "Lucas", "lucas@exemplo.com");

    expect(enviar.mock.calls[0][0].texto).toMatch(/já está ativa/i);
  });

  it("invalida os links anteriores ao emitir outro", async () => {
    const { servico: s, marcarUso } = servico();
    await s.enviar("u1", "Lucas", "lucas@exemplo.com");

    expect(marcarUso).toHaveBeenCalledWith({
      where: { usuarioId: "u1", usadoEm: null },
      data: { usadoEm: AGORA },
    });
  });

  it("falha de envio não propaga — o cadastro não pode cair por isso", async () => {
    // É chamada logo depois de criar a conta. Propagar deixaria a pessoa
    // sem conta e sem entender por quê.
    const aviso = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const { servico: s } = servico({ erroAoEnviar: new Error("smtp fora") });

    await expect(
      s.enviar("u1", "Lucas", "lucas@exemplo.com"),
    ).resolves.toBeUndefined();
    aviso.mockRestore();
  });
});

describe("VerificacaoDeEmailService.confirmar (RF-03)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const valido = {
    id: "t1",
    usuarioId: "u1",
    expiraEm: new Date(AGORA.getTime() + DIA),
    usadoEm: null,
  };

  it("marca o endereço como verificado", async () => {
    const { servico: s, marcarUsuario } = servico({ token: valido });
    const saida = await s.confirmar("token-cru");

    expect(saida).toEqual({ ok: true, jaConfirmado: false });
    expect(marcarUsuario).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { emailVerificadoEm: AGORA },
    });
  });

  it("clicar duas vezes no mesmo link não é erro", async () => {
    // Acontece o tempo todo, e quem clica de novo já tem o endereço
    // confirmado — tratar como falha ensinaria a desconfiar de algo que deu
    // certo.
    const { servico: s, marcarUsuario } = servico({
      token: { ...valido, usadoEm: AGORA },
    });

    await expect(s.confirmar("token-cru")).resolves.toEqual({
      ok: true,
      jaConfirmado: true,
    });
    expect(marcarUsuario).not.toHaveBeenCalled();
  });

  it("token inexistente e vencido são recusados com o motivo", async () => {
    for (const [token, motivo] of [
      [null, /inválido/i],
      [
        { ...valido, expiraEm: new Date(AGORA.getTime() - DIA) },
        /venceu/i,
      ],
    ] as const) {
      const { servico: s } = servico({ token });
      await expect(s.confirmar("t")).rejects.toThrow(motivo);
    }
  });

  it("não marca nada quando o token não vale", async () => {
    const { servico: s, marcarUsuario } = servico({ token: null });

    await expect(s.confirmar("t")).rejects.toThrow(BadRequestException);
    expect(marcarUsuario).not.toHaveBeenCalled();
  });

  it("quem perde a corrida pelo mesmo link vê 'já confirmado'", async () => {
    const { servico: s, marcarUsuario } = servico({
      token: valido,
      jaUsadoNaCorrida: true,
    });

    await expect(s.confirmar("token-cru")).resolves.toEqual({
      ok: true,
      jaConfirmado: true,
    });
    expect(marcarUsuario).not.toHaveBeenCalled();
  });
});
