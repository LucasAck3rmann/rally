// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PagamentosService } from "../pagamentos/pagamentos.service";
import { QuadrasService } from "../quadras/quadras.service";
import { ReservasService } from "./reservas.service";

/**
 * **As recusas de `criar()` (RF-08).**
 *
 * O caminho feliz tem suíte própria no `criar-com-cupom.spec.ts`. Aqui estão
 * as quatro portas que o pedido tem de passar antes de virar reserva, e que
 * não eram percorridas por teste nenhum — cada uma devolve um código
 * diferente, e o aplicativo trata cada um de um jeito.
 *
 * A distinção entre 400 e 409 não é formalidade: **400 diz "o pedido está
 * errado" e 409 diz "o pedido está certo e chegou tarde"**. Confundir os dois
 * manda o cliente corrigir o que não tem conserto, ou tentar de novo o que
 * nunca vai dar certo.
 */

const INICIO = "2026-10-20T22:00:00.000Z";
const FIM = "2026-10-20T23:00:00.000Z";
const PEDIDO = { quadraId: "q1", inicio: INICIO, fim: FIM };

/** O erro que o PostgreSQL levanta ao recusar a sobreposição, em português. */
function violacaoDeExclusao() {
  return new Prisma.PrismaClientUnknownRequestError(
    'PostgresError { code: "23P01", message: "valor-chave conflitante viola a ' +
      'restrição de exclusão \\"reserva_sem_sobreposicao\\"" }',
    { clientVersion: "6.19.3" },
  );
}

/** O impasse, que o banco escolhe quando desfaz um ciclo de espera. */
function impasse() {
  return new Prisma.PrismaClientUnknownRequestError(
    'PostgresError { code: "40P01", message: "impasse detectado" }',
    { clientVersion: "6.19.3" },
  );
}

function servico(opcoes: { quadra?: unknown; slots?: unknown[]; erroAoCriar?: unknown } = {}) {
  const criarReserva = opcoes.erroAoCriar
    ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
    : jest.fn().mockResolvedValue({ id: "r1" });

  const quadraPadrao = {
    id: "q1",
    nome: "Quadra 1",
    estabelecimentoId: "e1",
    estabelecimento: {
      nome: "Arena Beira-Rio",
      timezone: "America/Sao_Paulo",
      descontoPixPct: new Prisma.Decimal(0),
      cuponsAcumulam: false,
      pixExpiraMinutos: 30,
    },
  };

  const prisma = {
    quadra: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opcoes.quadra === undefined ? quadraPadrao : opcoes.quadra),
    },
    promocao: { findFirst: jest.fn().mockResolvedValue(null) },
    reserva: { findFirst: jest.fn().mockResolvedValue(null) },
    pagamento: { update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ promocao: { update: jest.fn() }, reserva: { create: criarReserva } }),
    ),
  } as unknown as PrismaService;

  const quadras = {
    disponibilidade: jest.fn().mockResolvedValue({
      slots: opcoes.slots ?? [{ inicio: INICIO, fim: FIM, preco: 100, disponivel: true }],
    }),
  } as unknown as QuadrasService;

  const pagamentos = {
    criarCobrancaPix: jest.fn().mockResolvedValue({
      gatewayId: "g1",
      copiaCola: "000201",
      qrCodeUrl: "https://exemplo/qr",
      expiraEm: new Date(),
    }),
  } as unknown as PagamentosService;

  return { servico: new ReservasService(prisma, quadras, pagamentos), criarReserva };
}

describe("ReservasService.criar — as recusas", () => {
  it("fim antes do início é pedido errado, e nem chega ao banco", async () => {
    const { servico: s, criarReserva } = servico();

    await expect(s.criar({ ...PEDIDO, inicio: FIM, fim: INICIO }, "u1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(criarReserva).not.toHaveBeenCalled();
  });

  it("fim igual ao início também é recusado: reserva de duração zero não existe", async () => {
    const { servico: s } = servico();
    await expect(s.criar({ ...PEDIDO, inicio: INICIO, fim: INICIO }, "u1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("quadra inexistente ou desativada é 404", async () => {
    const { servico: s } = servico({ quadra: null });
    await expect(s.criar(PEDIDO, "u1")).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * Fora da grade é **400**, e não 409: o horário pedido não existe na
   * quadra, e tentar de novo mais tarde não vai fazê-lo existir.
   */
  it("horário fora da grade é pedido errado, não disputa", async () => {
    const { servico: s } = servico({
      slots: [
        {
          inicio: "2026-10-20T23:00:00.000Z",
          fim: "2026-10-21T00:00:00.000Z",
          preco: 100,
          disponivel: true,
        },
      ],
    });

    await expect(s.criar(PEDIDO, "u1")).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * Indisponível é **409**: o horário existe e está tomado. Tentar de novo
   * mais tarde pode dar certo, e é isso que o código diz ao aplicativo.
   */
  it("horário que existe mas está ocupado é conflito", async () => {
    const { servico: s } = servico({
      slots: [{ inicio: INICIO, fim: FIM, preco: 100, disponivel: false }],
    });

    await expect(s.criar(PEDIDO, "u1")).rejects.toBeInstanceOf(ConflictException);
  });

  /**
   * A grade dizia disponível e o banco recusou — alguém reservou entre a
   * leitura e a escrita. A trava do banco é quem decide, e a tradução para
   * 409 é o que impede isso de chegar ao cliente como erro de servidor.
   */
  it("a colisão do banco vira conflito com a mensagem da corrida", async () => {
    const { servico: s } = servico({ erroAoCriar: violacaoDeExclusao() });

    await expect(s.criar(PEDIDO, "u1")).rejects.toThrow("Esse horário acabou de ser reservado.");
  });

  it("o impasse do banco também vira conflito, com a mensagem própria dele", async () => {
    // O `semImpasse` repete uma vez; como este dublê falha sempre, a segunda
    // volta também perde e a recusa sai — que é o comportamento declarado.
    const { servico: s, criarReserva } = servico({ erroAoCriar: impasse() });

    await expect(s.criar(PEDIDO, "u1")).rejects.toThrow(/disputado/i);
    expect(criarReserva).toHaveBeenCalledTimes(2);
  });
});
