// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PagamentosService } from "../pagamentos/pagamentos.service";
import { QuadrasService } from "../quadras/quadras.service";
import { ReservasService } from "./reservas.service";

/** Terça-feira, 16/06/2026, 10:00 em São Paulo (UTC-3). */
const AGORA = new Date("2026-06-16T13:00:00.000Z");

const HORA = 60 * 60 * 1000;

/** Reserva como o `cancelar` a lê — só os campos que ele seleciona. */
function reservaBase(extras: Record<string, unknown> = {}) {
  return {
    id: "r1",
    // 33h à frente: bem dentro da janela de 12h.
    inicio: new Date(AGORA.getTime() + 33 * HORA),
    status: ReservaStatus.CONFIRMADA,
    quadra: { estabelecimento: { cancelamentoHoras: 12 } },
    pagamento: { id: "p1", status: PagamentoStatus.PENDENTE },
    ...extras,
  };
}

/** Forma completa que o `detalhe` devolve depois do cancelamento. */
function detalheCancelado() {
  return {
    id: "r1",
    inicio: new Date(AGORA.getTime() + 33 * HORA),
    fim: new Date(AGORA.getTime() + 34 * HORA),
    status: ReservaStatus.CANCELADA,
    preco: new Prisma.Decimal(80),
    createdAt: AGORA,
    canceladaEm: AGORA,
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
  };
}

function servico(reserva: unknown) {
  const atualizaReserva = jest.fn();
  const atualizaPagamento = jest.fn();
  const prisma = {
    reserva: {
      findFirst: jest
        .fn()
        // 1ª chamada: a checagem do `cancelar`. 2ª: o `detalhe` do retorno.
        .mockResolvedValueOnce(reserva)
        .mockResolvedValue(detalheCancelado()),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        reserva: { update: atualizaReserva },
        pagamento: { update: atualizaPagamento },
      }),
    ),
  } as unknown as PrismaService;

  const servico = new ReservasService(
    prisma,
    {} as QuadrasService,
    {} as PagamentosService,
  );
  return { servico, atualizaReserva, atualizaPagamento };
}

describe("ReservasService.cancelar (RF-09 / RN-02)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("cancela dentro do prazo e encerra a cobrança em aberto", async () => {
    const { servico: s, atualizaReserva, atualizaPagamento } = servico(
      reservaBase(),
    );

    const saida = await s.cancelar("r1", "u1", "  mudei de ideia  ");

    expect(saida.dentroDoPrazo).toBe(true);
    expect(atualizaReserva).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({
          status: ReservaStatus.CANCELADA,
          canceladaEm: AGORA,
          motivoCancelamento: "mudei de ideia",
        }),
      }),
    );
    // Sem isto o app seguiria oferecendo "pagar" numa reserva morta.
    expect(atualizaPagamento).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: { status: PagamentoStatus.EXPIRADO },
      }),
    );
  });

  it("usa um motivo padrão quando o cliente não escreve nada", async () => {
    const { servico: s, atualizaReserva } = servico(reservaBase());

    await s.cancelar("r1", "u1");

    expect(atualizaReserva).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          motivoCancelamento: "Cancelada pelo cliente",
        }),
      }),
    );
  });

  it("cancela fora do prazo, mas avisa que está fora", async () => {
    // 6h à frente, com janela de 12h: libera o slot, sem direito a devolução.
    const { servico: s, atualizaReserva } = servico(
      reservaBase({ inicio: new Date(AGORA.getTime() + 6 * HORA) }),
    );

    const saida = await s.cancelar("r1", "u1");

    expect(saida.dentroDoPrazo).toBe(false);
    expect(atualizaReserva).toHaveBeenCalled();
  });

  it("não mexe numa cobrança já paga", async () => {
    const { servico: s, atualizaPagamento } = servico(
      reservaBase({ pagamento: { id: "p1", status: PagamentoStatus.PAGO } }),
    );

    await s.cancelar("r1", "u1");

    expect(atualizaPagamento).not.toHaveBeenCalled();
  });

  it("recusa cancelar duas vezes", async () => {
    const { servico: s } = servico(
      reservaBase({ status: ReservaStatus.CANCELADA }),
    );

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(ConflictException);
  });

  it("recusa cancelar uma reserva já concluída", async () => {
    const { servico: s } = servico(
      reservaBase({ status: ReservaStatus.CONCLUIDA }),
    );

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(ConflictException);
  });

  it("recusa cancelar depois que o horário começou", async () => {
    const { servico: s } = servico(
      reservaBase({ inicio: new Date(AGORA.getTime() - HORA) }),
    );

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(ConflictException);
  });

  it("não encontra a reserva de outro cliente", async () => {
    const { servico: s } = servico(null);

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(NotFoundException);
  });
});
