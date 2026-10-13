// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verify } from "@node-rs/argon2";
import { createHash } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { SenhaService } from "./senha.service";

const AGORA = new Date("2026-10-13T13:00:00.000Z");
const MINUTO = 60 * 1000;

function usuario(extras: Record<string, unknown> = {}) {
  return {
    id: "u1",
    nome: "Lucas",
    email: "lucas@exemplo.com",
    anonimizadoEm: null,
    ...extras,
  };
}

function servico(
  opcoes: {
    usuario?: unknown;
    token?: unknown;
    jaUsadoNaCorrida?: boolean;
    erroAoEnviar?: unknown;
  } = {},
) {
  const criarToken = jest.fn().mockResolvedValue({ id: "t1" });
  const invalidarAnteriores = jest
    .fn()
    .mockResolvedValue({ count: opcoes.jaUsadoNaCorrida ? 0 : 1 });
  const trocarSenha = jest.fn().mockResolvedValue({});
  const enviar = opcoes.erroAoEnviar
    ? jest.fn().mockRejectedValue(opcoes.erroAoEnviar)
    : jest.fn().mockResolvedValue(undefined);

  const prisma = {
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.usuario === undefined ? usuario() : opcoes.usuario,
        ),
      update: trocarSenha,
    },
    tokenDeSenha: {
      findUnique: jest.fn().mockResolvedValue(opcoes.token ?? null),
      updateMany: invalidarAnteriores,
      create: criarToken,
    },
  } as unknown as PrismaService & Record<string, never>;

  const config = {
    get: jest.fn().mockReturnValue("https://rally.exemplo"),
  } as unknown as ConfigService;

  return {
    servico: new SenhaService(prisma, config, { enviar }),
    prisma,
    criarToken,
    invalidarAnteriores,
    trocarSenha,
    enviar,
  };
}

/** O token que o e-mail levou, extraído do link. */
function tokenDoEmail(enviar: jest.Mock): string {
  const texto = enviar.mock.calls[0][0].texto as string;
  return texto.match(/token=([^\s]+)/)![1];
}

describe("SenhaService.recuperar (RF-03)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("responde igual para e-mail cadastrado e não cadastrado", async () => {
    // A diferença entre as duas respostas seria uma lista de clientes da
    // arena. É a mesma decisão já tomada na mensagem de erro do login.
    const existe = await servico().servico.recuperar("lucas@exemplo.com");
    const naoExiste = await servico({ usuario: null }).servico.recuperar(
      "ninguem@exemplo.com",
    );

    expect(existe).toEqual(naoExiste);
    expect(existe.mensagem).toMatch(/se houver conta/i);
  });

  it("e-mail não cadastrado não gera token nem envio", async () => {
    const { servico: s, criarToken, enviar } = servico({ usuario: null });
    await s.recuperar("ninguem@exemplo.com");

    expect(criarToken).not.toHaveBeenCalled();
    expect(enviar).not.toHaveBeenCalled();
  });

  it("conta anonimizada não recebe link", async () => {
    // Ela existe para preservar histórico financeiro, não para voltar a ser
    // usada.
    const { servico: s, enviar } = servico({
      usuario: usuario({ anonimizadoEm: AGORA }),
    });
    await s.recuperar("lucas@exemplo.com");

    expect(enviar).not.toHaveBeenCalled();
  });

  it("procura o e-mail sem ligar para caixa nem espaço", async () => {
    const { servico: s, prisma } = servico();
    await s.recuperar("  LUCAS@Exemplo.com  ");

    expect((prisma.usuario.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({
      email: "lucas@exemplo.com",
    });
  });

  it("guarda o hash do token, nunca o token", async () => {
    // Quem lesse a tabela poderia redefinir a senha de qualquer pessoa — o
    // mesmo motivo de `senhaHash` existir.
    const { servico: s, criarToken, enviar } = servico();
    await s.recuperar("lucas@exemplo.com");

    const token = tokenDoEmail(enviar);
    const gravado = criarToken.mock.calls[0][0].data.tokenHash;

    expect(gravado).toBe(createHash("sha256").update(token).digest("hex"));
    expect(gravado).not.toBe(token);
    expect(JSON.stringify(criarToken.mock.calls[0][0])).not.toContain(token);
  });

  it("o link vence em trinta minutos", async () => {
    const { servico: s, criarToken, enviar } = servico();
    await s.recuperar("lucas@exemplo.com");

    expect(criarToken.mock.calls[0][0].data.expiraEm).toEqual(
      new Date(AGORA.getTime() + 30 * MINUTO),
    );
    expect(enviar.mock.calls[0][0].texto).toContain("30 minutos");
  });

  it("invalida os pedidos anteriores antes de emitir o novo", async () => {
    // Dois links válidos ao mesmo tempo dobram a janela de quem interceptou
    // o primeiro, e não ganham nada.
    const { servico: s, invalidarAnteriores } = servico();
    await s.recuperar("lucas@exemplo.com");

    expect(invalidarAnteriores).toHaveBeenCalledWith({
      where: { usuarioId: "u1", usadoEm: null },
      data: { usadoEm: AGORA },
    });
  });

  it("o e-mail diz o que fazer se não foi a pessoa", async () => {
    const { servico: s, enviar } = servico();
    await s.recuperar("lucas@exemplo.com");

    const { para, assunto, texto } = enviar.mock.calls[0][0];
    expect(para).toBe("lucas@exemplo.com");
    expect(assunto).toMatch(/redefinir/i);
    expect(texto).toContain("https://rally.exemplo/redefinir-senha?token=");
    expect(texto).toMatch(/se não foi você/i);
    expect(texto).toMatch(/uma vez/i);
  });

  it("falha no envio não vira erro para quem pediu", async () => {
    // A resposta já foi decidida e precisa ser igual nos dois casos;
    // propagar daqui transformaria falha de envio em sinal de que o e-mail
    // existe.
    const aviso = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    const { servico: s } = servico({ erroAoEnviar: new Error("smtp fora") });

    await expect(s.recuperar("lucas@exemplo.com")).resolves.toMatchObject({
      ok: true,
    });
    aviso.mockRestore();
  });
});

describe("SenhaService.redefinir (RF-03)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  const valido = {
    id: "t1",
    usuarioId: "u1",
    expiraEm: new Date(AGORA.getTime() + 10 * MINUTO),
    usadoEm: null,
  };

  it("troca a senha e guarda o hash, nunca o texto", async () => {
    const { servico: s, trocarSenha } = servico({ token: valido });
    const saida = await s.redefinir("token-cru", "senhanova1");

    expect(saida.ok).toBe(true);
    const { senhaHash } = trocarSenha.mock.calls[0][0].data;
    expect(senhaHash).not.toBe("senhanova1");
    await expect(verify(senhaHash, "senhanova1")).resolves.toBe(true);
  });

  it("procura pelo hash do token recebido", async () => {
    const { servico: s, prisma } = servico({ token: valido });
    await s.redefinir("token-cru", "senhanova1");

    expect((prisma.tokenDeSenha.findUnique as jest.Mock).mock.calls[0][0].where)
      .toEqual({
        tokenHash: createHash("sha256").update("token-cru").digest("hex"),
      });
  });

  it("distingue inválido, já usado e vencido", async () => {
    // Quem chega com um token na mão já o recebeu por e-mail: dizer qual é o
    // caso não revela nada, e é o que faz a pessoa pedir outro link em vez
    // de tentar o mesmo de novo.
    const casos: [unknown, RegExp][] = [
      [null, /inválido/i],
      [{ ...valido, usadoEm: AGORA }, /já foi usado/i],
      [{ ...valido, expiraEm: new Date(AGORA.getTime() - MINUTO) }, /venceu/i],
    ];

    for (const [token, motivo] of casos) {
      const { servico: s } = servico({ token });
      await expect(s.redefinir("t", "senhanova1")).rejects.toThrow(motivo);
    }
  });

  it("não troca a senha quando o token não vale", async () => {
    const { servico: s, trocarSenha } = servico({ token: null });

    await expect(s.redefinir("t", "senhanova1")).rejects.toThrow(
      BadRequestException,
    );
    expect(trocarSenha).not.toHaveBeenCalled();
  });

  it("marca o uso antes de trocar a senha, filtrando por não usado", async () => {
    // Dois cliques simultâneos no mesmo link disputam esta escrita. Sem o
    // filtro, a senha seria trocada duas vezes e a segunda venceria —
    // inclusive a de quem interceptou o link.
    const { servico: s, invalidarAnteriores } = servico({ token: valido });
    await s.redefinir("token-cru", "senhanova1");

    expect(invalidarAnteriores).toHaveBeenCalledWith({
      where: { id: "t1", usadoEm: null },
      data: { usadoEm: AGORA },
    });
  });

  it("quem perde a corrida pelo mesmo link não troca a senha", async () => {
    const { servico: s, trocarSenha } = servico({
      token: valido,
      jaUsadoNaCorrida: true,
    });

    await expect(s.redefinir("token-cru", "senhanova1")).rejects.toThrow(
      /já foi usado/i,
    );
    expect(trocarSenha).not.toHaveBeenCalled();
  });
});
