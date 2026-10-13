// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  PagamentoMetodo,
  Prisma,
  PromocaoTipo,
  ReservaStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PagamentosService } from "../pagamentos/pagamentos.service";
import { QuadrasService } from "../quadras/quadras.service";
import { ReservasService } from "./reservas.service";

/**
 * O caminho do cupom dentro de `criar()` (RF-14, RN-14).
 *
 * As regras de preço em si moram em `cupom.spec.ts`, sem banco nenhum. Aqui
 * o que está sob teste é a **ligação**: se o cupom certo é procurado dentro
 * do estabelecimento certo, se o uso e a reserva nascem na mesma transação,
 * e se a recusa do banco vira 409 com motivo em vez de 500.
 */

const AGORA = new Date("2026-10-13T13:00:00.000Z");
const INICIO = "2026-10-20T22:00:00.000Z";
const FIM = "2026-10-20T23:00:00.000Z";

function cupomNoBanco(parcial: Record<string, unknown> = {}) {
  return {
    id: "promo1",
    codigo: "BORAJOGAR",
    tipo: PromocaoTipo.PERCENTUAL,
    valor: new Prisma.Decimal(20),
    validadeInicio: new Date("2026-10-01T00:00:00.000Z"),
    validadeFim: new Date("2026-12-31T23:59:59.000Z"),
    usosMax: 200,
    usosFeitos: 3,
    ativo: true,
    ...parcial,
  };
}

function servico(
  opcoes: {
    cupom?: unknown;
    descontoPixPct?: number;
    cuponsAcumulam?: boolean;
    erroAoCriar?: unknown;
  } = {},
) {
  const criarReserva = opcoes.erroAoCriar
    ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
    : jest.fn().mockResolvedValue({ id: "r1" });
  const usarCupom = jest.fn().mockResolvedValue({});

  const prisma = {
    quadra: {
      findFirst: jest.fn().mockResolvedValue({
        id: "q1",
        nome: "Quadra 1",
        estabelecimentoId: "e1",
        estabelecimento: {
          nome: "Arena Beira-Rio",
          timezone: "America/Sao_Paulo",
          descontoPixPct: new Prisma.Decimal(opcoes.descontoPixPct ?? 0),
          cuponsAcumulam: opcoes.cuponsAcumulam ?? false,
          pixExpiraMinutos: 30,
        },
      }),
    },
    promocao: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.cupom === undefined ? cupomNoBanco() : opcoes.cupom,
        ),
    },
    reserva: {
      // O `detalhe()` do retorno; forma mínima que `paraDto` aceita.
      findFirst: jest.fn().mockResolvedValue({
        id: "r1",
        inicio: new Date(INICIO),
        fim: new Date(FIM),
        status: ReservaStatus.PENDENTE_PAGAMENTO,
        preco: new Prisma.Decimal(100),
        createdAt: AGORA,
        canceladaEm: null,
        quadra: {
          id: "q1",
          nome: "Quadra 1",
          fotos: [],
          modalidades: [],
          estabelecimento: {
            id: "e1",
            nome: "Arena Beira-Rio",
            bairro: null,
            cidade: null,
            uf: null,
            timezone: "America/Sao_Paulo",
            cancelamentoHoras: 12,
          },
        },
        pagamento: null,
      }),
    },
    pagamento: { update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        promocao: { update: usarCupom },
        reserva: { create: criarReserva },
      }),
    ),
  } as unknown as PrismaService;

  const quadras = {
    disponibilidade: jest.fn().mockResolvedValue({
      slots: [{ inicio: INICIO, fim: FIM, preco: 100, disponivel: true }],
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

  return {
    servico: new ReservasService(prisma, quadras, pagamentos),
    prisma,
    criarReserva,
    usarCupom,
  };
}

const PEDIDO = { quadraId: "q1", inicio: INICIO, fim: FIM };

/** Valor gravado no `Pagamento` da chamada de criação. */
function valorCobrado(criarReserva: jest.Mock): number {
  return Number(
    criarReserva.mock.calls[0][0].data.pagamento.create.valor.toString(),
  );
}

describe("ReservasService.criar com cupom (RF-14, RN-14)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it("aplica o cupom e registra o uso na mesma transação da reserva", async () => {
    // Um contador adiantado sem reserva tiraria do ar um uso que ninguém
    // aproveitou; uma reserva com cupom não contabilizado fura o limite.
    const { servico: s, criarReserva, usarCupom } = servico();

    await s.criar({ ...PEDIDO, cupom: "BORAJOGAR" }, "u1");

    expect(valorCobrado(criarReserva)).toBe(80); // 20% de R$ 100
    expect(criarReserva.mock.calls[0][0].data.promocaoId).toBe("promo1");
    expect(usarCupom).toHaveBeenCalledWith({
      where: { id: "promo1" },
      data: { usosFeitos: { increment: 1 } },
    });
  });

  it("sem cupom, não mexe em promoção nenhuma", async () => {
    const { servico: s, criarReserva, usarCupom } = servico();

    await s.criar(PEDIDO, "u1");

    expect(usarCupom).not.toHaveBeenCalled();
    expect(criarReserva.mock.calls[0][0].data.promocaoId).toBeUndefined();
  });

  it("procura o cupom dentro do estabelecimento da quadra, sem ligar para a caixa", async () => {
    // Um código de uma arena não vale em outra, mesmo que o texto coincida;
    // e ninguém digita cupom com o cuidado de uma senha.
    const { servico: s, prisma } = servico();

    await s.criar({ ...PEDIDO, cupom: "  borajogar  " }, "u1");

    expect((prisma.promocao.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
      estabelecimentoId: "e1",
      codigo: { equals: "borajogar", mode: "insensitive" },
    });
  });

  it("cupom inexistente é 404, e não desconto silencioso", async () => {
    const { servico: s } = servico({ cupom: null });

    await expect(
      s.criar({ ...PEDIDO, cupom: "NAOEXISTE" }, "u1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("cupom vencido é recusado com o motivo", async () => {
    const { servico: s, usarCupom } = servico({
      cupom: cupomNoBanco({ validadeFim: new Date("2026-10-01T00:00:00.000Z") }),
    });

    await expect(
      s.criar({ ...PEDIDO, cupom: "BORAJOGAR" }, "u1"),
    ).rejects.toThrow(/venceu/i);
    expect(usarCupom).not.toHaveBeenCalled();
  });

  it("cupom esgotado na conferência não chega a abrir a transação", async () => {
    const { servico: s, usarCupom } = servico({
      cupom: cupomNoBanco({ usosMax: 10, usosFeitos: 10 }),
    });

    await expect(
      s.criar({ ...PEDIDO, cupom: "BORAJOGAR" }, "u1"),
    ).rejects.toThrow(/limite de usos/i);
    expect(usarCupom).not.toHaveBeenCalled();
  });

  it("cupom esgotado na corrida vira 409 com motivo, não 500", async () => {
    // Entre a conferência e a escrita cabe outra requisição usando o último
    // uso; quem segura é a restrição do banco.
    const { servico: s } = servico({
      erroAoCriar: new Error(
        'new row for relation "Promocao" violates check constraint "promocao_usos_dentro_do_limite"',
      ),
    });

    await expect(
      s.criar({ ...PEDIDO, cupom: "BORAJOGAR" }, "u1"),
    ).rejects.toThrow(ConflictException);
    await expect(
      s.criar({ ...PEDIDO, cupom: "BORAJOGAR" }, "u1"),
    ).rejects.toThrow(/limite de usos/i);
  });

  it("erro que não é de cupom nem de horário sobe inteiro", async () => {
    // Engolir tudo como 409 esconderia falha de banco atrás de uma mensagem
    // que culpa o cliente.
    const { servico: s } = servico({ erroAoCriar: new Error("conexão caiu") });

    await expect(
      s.criar({ ...PEDIDO, cupom: "BORAJOGAR" }, "u1"),
    ).rejects.toThrow("conexão caiu");
  });

  it("cupom pior que o desconto do Pix não faz o cliente pagar mais", async () => {
    // A regra mora em `cupom.ts`; aqui se confere que `criar()` usa ela, e
    // não uma segunda conta própria.
    const { servico: s, criarReserva } = servico({
      descontoPixPct: 30,
      cupom: cupomNoBanco({ valor: new Prisma.Decimal(5) }),
    });

    await s.criar(
      { ...PEDIDO, cupom: "BORAJOGAR", metodo: PagamentoMetodo.PIX },
      "u1",
    );

    expect(valorCobrado(criarReserva)).toBe(70);
  });

  it("no cartão o desconto do Pix não entra, mas o cupom entra", async () => {
    const { servico: s, criarReserva } = servico({ descontoPixPct: 30 });

    await s.criar(
      { ...PEDIDO, cupom: "BORAJOGAR", metodo: PagamentoMetodo.CARTAO },
      "u1",
    );

    expect(valorCobrado(criarReserva)).toBe(80);
  });
});
