// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PrivacidadeService } from "./privacidade.service";

const AGORA = new Date("2026-10-13T13:00:00.000Z");

function usuarioCompleto(extras: Record<string, unknown> = {}) {
  return {
    id: "u1",
    nome: "Lucas Ackermann",
    email: "lucas@exemplo.com",
    telefone: "51999999999",
    avatarUrl: "https://exemplo/foto.png",
    consentLgpdEm: AGORA,
    emailVerificadoEm: AGORA,
    anonimizadoEm: null,
    createdAt: AGORA,
    notifPref: {
      canalWhatsapp: true,
      canalEmail: true,
      canalPush: false,
      marketingOptIn: false,
    },
    memberships: [{ role: Role.ADMIN, estabelecimento: { nome: "Arena Beira-Rio" } }],
    reservas: [
      {
        id: "r1",
        inicio: AGORA,
        fim: AGORA,
        status: "CONFIRMADA",
        preco: new Prisma.Decimal(80),
        createdAt: AGORA,
        canceladaEm: null,
        quadra: {
          nome: "Quadra 1",
          estabelecimento: { nome: "Arena Beira-Rio" },
        },
        pagamento: {
          status: "PAGO",
          metodo: "PIX",
          valor: new Prisma.Decimal(76),
          pagoEm: AGORA,
        },
      },
    ],
    notificacoes: [
      {
        tipo: "PAGAMENTO",
        titulo: "Pagamento confirmado",
        corpo: "Arena Beira-Rio · Quadra 1",
        createdAt: AGORA,
      },
    ],
    ...extras,
  };
}

function servico(
  opcoes: {
    usuario?: unknown;
    paraExcluir?: unknown;
    adminDe?: { estabelecimentoId: string }[];
    outrosAdmins?: number;
  } = {},
) {
  const apagados: Record<string, number> = {};
  const apagar = (nome: string) =>
    jest.fn(async () => {
      apagados[nome] = (apagados[nome] ?? 0) + 1;
      return { count: 1 };
    });

  const atualizarUsuario = jest.fn().mockResolvedValue({});
  const tx = {
    notificacao: { deleteMany: apagar("notificacao") },
    tokenDeSenha: { deleteMany: apagar("tokenDeSenha") },
    tokenDeEmail: { deleteMany: apagar("tokenDeEmail") },
    refreshToken: { deleteMany: apagar("refreshToken") },
    account: { deleteMany: apagar("account") },
    waitlistEntry: { deleteMany: apagar("waitlistEntry") },
    notificationPreference: { deleteMany: apagar("notificationPreference") },
    membership: { deleteMany: apagar("membership") },
    usuario: { update: atualizarUsuario },
  };

  const findUnique = jest.fn(async (args: { select?: Record<string, unknown> }) =>
    args.select &&
    "anonimizadoEm" in args.select &&
    "id" in args.select &&
    Object.keys(args.select).length === 2
      ? opcoes.paraExcluir === undefined
        ? { id: "u1", anonimizadoEm: null }
        : opcoes.paraExcluir
      : opcoes.usuario === undefined
        ? usuarioCompleto()
        : opcoes.usuario,
  );

  const prisma = {
    usuario: { findUnique },
    membership: {
      findMany: jest.fn().mockResolvedValue(opcoes.adminDe ?? []),
      count: jest.fn().mockResolvedValue(opcoes.outrosAdmins ?? 0),
    },
    estabelecimento: {
      findUnique: jest.fn().mockResolvedValue({ nome: "Arena Beira-Rio" }),
    },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as PrismaService & Record<string, never>;

  return {
    servico: new PrivacidadeService(prisma),
    prisma,
    apagados,
    atualizarUsuario,
  };
}

describe("PrivacidadeService.exportar (RNF-07)", () => {
  it("traz conta, reservas, avisos, vínculos e preferências", async () => {
    const { servico: s } = servico();
    const saida = await s.exportar("u1");

    expect(saida.conta).toMatchObject({ nome: "Lucas Ackermann" });
    expect(saida.reservas).toHaveLength(1);
    expect(saida.avisos).toHaveLength(1);
    expect(saida.vinculos).toEqual([{ estabelecimento: "Arena Beira-Rio", papel: Role.ADMIN }]);
    expect(saida.preferenciasDeAviso).toMatchObject({ canalPush: false });
  });

  it("a reserva vem com nome de quadra e de arena, não só identificador", async () => {
    // Exportar dado que ninguém consegue interpretar cumpre a letra e perde
    // o propósito: o direito é de portabilidade.
    const { servico: s } = servico();
    const [reserva] = (await s.exportar("u1")).reservas;

    expect(reserva.arena).toBe("Arena Beira-Rio");
    expect(reserva.quadra).toBe("Quadra 1");
  });

  it("converte Decimal em número, para outro sistema conseguir ler", async () => {
    const { servico: s } = servico();
    const [reserva] = (await s.exportar("u1")).reservas;

    expect(typeof reserva.preco).toBe("number");
    expect(reserva.preco).toBe(80);
    expect(reserva.pagamento?.valor).toBe(76);
  });

  it("diz no próprio arquivo o que não está nele", async () => {
    // Quem recebe a exportação precisa saber que senha não sai dali, sem
    // ter de perguntar.
    const { servico: s } = servico();
    const saida = await s.exportar("u1");

    expect(saida.observacao).toMatch(/senha/i);
    expect(JSON.stringify(saida)).not.toContain("senhaHash");
  });

  it("usuário inexistente é 404", async () => {
    const { servico: s } = servico({ usuario: null });
    await expect(s.exportar("u9")).rejects.toThrow(NotFoundException);
  });

  it("conta incompleta exporta com `null` explícito, e não quebra nem omite", async () => {
    // **O caso mais provável de verdade, e o que estava sem teste.** Quem se
    // cadastra e não verifica o e-mail, não tem consentimento registrado e
    // deixa um Pix pendente é a conta comum de quem experimentou o
    // aplicativo uma vez — e a exportação é obrigação legal (RNF-07), de
    // modo que ela precisa funcionar em **qualquer** estado da conta, não no
    // estado bonito.
    //
    // Cada campo aqui passa por um `?.toISOString() ?? null`. Sem o recuo, o
    // acesso em `undefined` estouraria; com ele devolvendo `undefined` em vez
    // de `null`, a chave **desapareceria** do JSON — e um arquivo que omite o
    // campo diz ao titular algo diferente de um que o traz vazio.
    const { servico: s } = servico({
      usuario: usuarioCompleto({
        consentLgpdEm: null,
        emailVerificadoEm: null,
        reservas: [
          {
            id: "r1",
            inicio: AGORA,
            fim: AGORA,
            status: "PENDENTE_PAGAMENTO",
            preco: new Prisma.Decimal(80),
            createdAt: AGORA,
            canceladaEm: null,
            quadra: { nome: "Quadra 1", estabelecimento: { nome: "Arena Beira-Rio" } },
            pagamento: {
              status: "PENDENTE",
              metodo: "PIX",
              valor: new Prisma.Decimal(76),
              pagoEm: null,
            },
          },
        ],
      }),
    });

    const saida = await s.exportar("u1");

    expect(saida.conta.consentimentoLgpdEm).toBeNull();
    expect(saida.conta.emailVerificadoEm).toBeNull();
    expect(saida.reservas[0].pagamento?.pagoEm).toBeNull();
    // As chaves **existem**, com valor nulo — é a diferença entre "não há" e
    // "não perguntamos".
    expect(saida.conta).toHaveProperty("consentimentoLgpdEm");
    expect(saida.conta).toHaveProperty("emailVerificadoEm");
    expect(saida.reservas[0].pagamento).toHaveProperty("pagoEm");
  });
});

describe("PrivacidadeService.excluirConta (RNF-07)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("anonimiza em vez de apagar, e tira o que identifica", async () => {
    // Apagar a linha levaria junto reservas e pagamentos, que o
    // estabelecimento guarda por obrigação fiscal.
    const { servico: s, atualizarUsuario } = servico();
    await s.excluirConta("u1");

    const dados = atualizarUsuario.mock.calls[0][0].data;
    expect(dados).toMatchObject({
      nome: "Usuário removido",
      telefone: null,
      avatarUrl: null,
      senhaHash: null,
      anonimizadoEm: AGORA,
    });
  });

  it("o e-mail vira endereço que nunca entrega, e segue único", async () => {
    // `.invalid` é reservado pela RFC 2606 para nunca resolver: a coluna
    // continua única e nenhuma mensagem sai dali por engano.
    const { servico: s, atualizarUsuario } = servico();
    await s.excluirConta("u1");

    const { email } = atualizarUsuario.mock.calls[0][0].data;
    expect(email).toContain("u1");
    expect(email.endsWith("@rally.invalid")).toBe(true);
  });

  it("apaga o que é pessoal e não é registro financeiro", async () => {
    const { servico: s, apagados } = servico();
    await s.excluirConta("u1");

    for (const tabela of [
      "notificacao",
      "tokenDeSenha",
      "tokenDeEmail",
      "refreshToken",
      "account",
      "waitlistEntry",
      "notificationPreference",
      "membership",
    ]) {
      expect(apagados[tabela]).toBe(1);
    }
  });

  it("tudo acontece na mesma transação", async () => {
    // Metade apagada com a conta ainda identificável seria o pior dos
    // desfechos: perde dado e não cumpre o direito.
    const { servico: s, prisma } = servico();
    await s.excluirConta("u1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("recusa enquanto a pessoa for a última administradora de uma arena", async () => {
    // Mesma regra que o módulo de equipe protege ao trocar papel: sem
    // administrador ninguém mais gere a arena, e não há tela para desfazer
    // porque a tela exige ser administrador.
    const { servico: s, atualizarUsuario } = servico({
      adminDe: [{ estabelecimentoId: "e1" }],
      outrosAdmins: 0,
    });

    await expect(s.excluirConta("u1")).rejects.toThrow(ConflictException);
    await expect(s.excluirConta("u1")).rejects.toThrow(/promova outra pessoa/i);
    expect(atualizarUsuario).not.toHaveBeenCalled();
  });

  it("sem conseguir ler o nome da arena, a recusa ainda diz o que fazer", async () => {
    // Caminho defensivo: o vínculo aponta um estabelecimento que a consulta
    // seguinte não acha — estado inconsistente do banco. O `?? "uma arena"`
    // existe para que a recusa **continue acionável**: sem ele a mensagem
    // sairia com `undefined` no meio, e quem a lê não saberia onde promover
    // outro administrador. A recusa em si é o que importa, e ela se mantém.
    const {
      servico: s,
      prisma,
      atualizarUsuario,
    } = servico({
      adminDe: [{ estabelecimentoId: "e1" }],
      outrosAdmins: 0,
    });
    (prisma.estabelecimento.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(s.excluirConta("u1")).rejects.toThrow(ConflictException);
    await expect(s.excluirConta("u1")).rejects.toThrow(/uma arena/);
    await expect(s.excluirConta("u1")).rejects.not.toThrow(/undefined/);
    expect(atualizarUsuario).not.toHaveBeenCalled();
  });

  it("com outro administrador na arena, a exclusão segue", async () => {
    const { servico: s, atualizarUsuario } = servico({
      adminDe: [{ estabelecimentoId: "e1" }],
      outrosAdmins: 1,
    });

    await expect(s.excluirConta("u1")).resolves.toMatchObject({ ok: true });
    expect(atualizarUsuario).toHaveBeenCalled();
  });

  it("pedir de novo não é erro, e devolve a data da primeira vez", async () => {
    // Quem clica duas vezes já teve a conta eliminada; tratar como falha
    // ensinaria a desconfiar de algo que deu certo.
    const { servico: s, atualizarUsuario } = servico({
      paraExcluir: { id: "u1", anonimizadoEm: AGORA },
    });

    await expect(s.excluirConta("u1")).resolves.toEqual({
      ok: true,
      anonimizadoEm: AGORA.toISOString(),
    });
    expect(atualizarUsuario).not.toHaveBeenCalled();
  });

  it("usuário inexistente é 404", async () => {
    const { servico: s } = servico({ paraExcluir: null });
    await expect(s.excluirConta("u9")).rejects.toThrow(NotFoundException);
  });
});
