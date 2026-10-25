// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PagamentoMetodo, PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

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
function detalheCompleto() {
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
        .mockResolvedValue(detalheCompleto()),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        reserva: { update: atualizaReserva },
        pagamento: { update: atualizaPagamento },
      }),
    ),
  } as unknown as PrismaService;

  const servico = new ReservasService(prisma, {} as QuadrasService, {} as PagamentosService);
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
    const { servico: s, atualizaReserva, atualizaPagamento } = servico(reservaBase());

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
    const { servico: s } = servico(reservaBase({ status: ReservaStatus.CANCELADA }));

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(ConflictException);
  });

  it("recusa cancelar uma reserva já concluída", async () => {
    const { servico: s } = servico(reservaBase({ status: ReservaStatus.CONCLUIDA }));

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(ConflictException);
  });

  it("recusa cancelar depois que o horário começou", async () => {
    const { servico: s } = servico(reservaBase({ inicio: new Date(AGORA.getTime() - HORA) }));

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(ConflictException);
  });

  it("não encontra a reserva de outro cliente", async () => {
    const { servico: s } = servico(null);

    await expect(s.cancelar("r1", "u1")).rejects.toThrow(NotFoundException);
  });
});

/** Reserva como o `remarcar` a lê. */
function reservaParaRemarcar(extras: Record<string, unknown> = {}) {
  return {
    id: "r1",
    inicio: new Date(AGORA.getTime() + 33 * HORA),
    fim: new Date(AGORA.getTime() + 34 * HORA),
    status: ReservaStatus.CONFIRMADA,
    quadraId: "q1",
    quadra: {
      nome: "Quadra 1",
      estabelecimento: {
        nome: "Arena Beira-Rio",
        timezone: "America/Sao_Paulo",
        cancelamentoHoras: 12,
        descontoPixPct: new Prisma.Decimal(5),
        pixExpiraMinutos: 30,
      },
    },
    pagamento: {
      id: "p1",
      status: PagamentoStatus.PENDENTE,
      metodo: PagamentoMetodo.PIX,
      // 80 com 5% de desconto do Pix.
      valor: new Prisma.Decimal(76),
    },
    ...extras,
  };
}

/** Slot livre 40h à frente, que é para onde os testes tentam mover. */
const NOVO_INICIO = new Date(AGORA.getTime() + 40 * HORA);
const NOVO_FIM = new Date(AGORA.getTime() + 41 * HORA);

function slotLivre(preco = 80, disponivel = true) {
  return {
    inicio: NOVO_INICIO.toISOString(),
    fim: NOVO_FIM.toISOString(),
    preco,
    disponivel,
  };
}

function servicoRemarcar(reserva: unknown, slots: unknown[], erroNoUpdate?: unknown) {
  const atualizaReserva = erroNoUpdate ? jest.fn().mockRejectedValue(erroNoUpdate) : jest.fn();
  const atualizaPagamento = jest.fn();
  const criarCobrancaPix = jest.fn().mockResolvedValue({
    gatewayId: "g2",
    copiaCola: "00020126BR",
    qrCodeUrl: null,
    expiraEm: new Date(AGORA.getTime() + 30 * 60 * 1000),
  });

  const prisma = {
    reserva: {
      findFirst: jest.fn().mockResolvedValueOnce(reserva).mockResolvedValue(detalheCompleto()),
      update: atualizaReserva,
    },
    pagamento: { update: atualizaPagamento },
  } as unknown as PrismaService;

  const servico = new ReservasService(
    prisma,
    { disponibilidade: jest.fn().mockResolvedValue({ slots }) } as unknown as QuadrasService,
    { criarCobrancaPix } as unknown as PagamentosService,
  );
  return { servico, atualizaReserva, atualizaPagamento, criarCobrancaPix };
}

function pedido(inicio = NOVO_INICIO, fim = NOVO_FIM) {
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

describe("ReservasService.remarcar (RF-09 / RN-02)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("move a reserva para o novo horário", async () => {
    const { servico: s, atualizaReserva } = servicoRemarcar(reservaParaRemarcar(), [slotLivre()]);

    await s.remarcar("r1", "u1", pedido());

    expect(atualizaReserva).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({ inicio: NOVO_INICIO, fim: NOVO_FIM }),
      }),
    );
  });

  it("recusa remarcar fora da janela de cancelamento", async () => {
    // Esta é a regra que sustenta a RN-02: se remarcar valesse fora do prazo,
    // bastaria empurrar a reserva para daqui a um mês — onde a janela volta a
    // estar aberta — e cancelar de graça.
    const { servico: s, atualizaReserva } = servicoRemarcar(
      reservaParaRemarcar({ inicio: new Date(AGORA.getTime() + 6 * HORA) }),
      [slotLivre()],
    );

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(ConflictException);
    expect(atualizaReserva).not.toHaveBeenCalled();
  });

  it("recusa remarcar para o mesmo horário", async () => {
    const reserva = reservaParaRemarcar();
    const { servico: s } = servicoRemarcar(reserva, [slotLivre()]);

    await expect(s.remarcar("r1", "u1", pedido(reserva.inicio, reserva.fim))).rejects.toThrow(
      BadRequestException,
    );
  });

  it("recusa um horário que não está na grade", async () => {
    const { servico: s } = servicoRemarcar(reservaParaRemarcar(), []);

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(BadRequestException);
  });

  it("recusa um horário ocupado", async () => {
    const { servico: s } = servicoRemarcar(reservaParaRemarcar(), [slotLivre(80, false)]);

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(ConflictException);
  });

  it("reemite a cobrança Pix quando o preço do novo horário muda", async () => {
    // O valor vai dentro do BR Code: manter a cobrança antiga cobraria errado.
    const {
      servico: s,
      criarCobrancaPix,
      atualizaPagamento,
    } = servicoRemarcar(reservaParaRemarcar(), [slotLivre(100)]);

    await s.remarcar("r1", "u1", pedido());

    expect(criarCobrancaPix).toHaveBeenCalledWith(
      expect.objectContaining({ reservaId: "r1", valor: 95 }),
    );
    expect(atualizaPagamento).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pixCopiaCola: "00020126BR" }),
      }),
    );
  });

  it("não mexe na cobrança quando o preço é o mesmo", async () => {
    const {
      servico: s,
      criarCobrancaPix,
      atualizaPagamento,
    } = servicoRemarcar(reservaParaRemarcar(), [slotLivre(80)]);

    await s.remarcar("r1", "u1", pedido());

    expect(criarCobrancaPix).not.toHaveBeenCalled();
    expect(atualizaPagamento).not.toHaveBeenCalled();
  });

  it("recusa mudar de preço quando a reserva já está paga", async () => {
    // Cobrar ou devolver a diferença é RF-14/RF-15, que ainda não existem.
    const { servico: s } = servicoRemarcar(
      reservaParaRemarcar({
        pagamento: {
          id: "p1",
          status: PagamentoStatus.PAGO,
          metodo: PagamentoMetodo.PIX,
          valor: new Prisma.Decimal(76),
        },
      }),
      [slotLivre(100)],
    );

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(ConflictException);
  });

  it("recusa remarcar uma reserva cancelada", async () => {
    const { servico: s } = servicoRemarcar(
      reservaParaRemarcar({ status: ReservaStatus.CANCELADA }),
      [slotLivre()],
    );

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(ConflictException);
  });

  it("traduz a colisão do banco em conflito de horário", async () => {
    const colisao = new Error(
      'conflicting key value violates exclusion constraint "reserva_sem_sobreposicao"',
    );
    const { servico: s } = servicoRemarcar(reservaParaRemarcar(), [slotLivre()], colisao);

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(ConflictException);
  });

  it("o impasse do banco também vira conflito, com a mensagem da disputa", async () => {
    // O conflito acima prova que o intervalo está tomado; o impasse prova só
    // que esta transação perdeu a disputa. São dois ramos e duas mensagens.
    const impasse = new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "40P01", message: "impasse detectado" }',
      { clientVersion: "6.19.3" },
    );
    const { servico: s } = servicoRemarcar(reservaParaRemarcar(), [slotLivre()], impasse);

    await expect(s.remarcar("r1", "u1", pedido())).rejects.toThrow(/disputado/i);
  });

  it("fim antes do início é recusado antes de qualquer consulta", async () => {
    const { servico: s } = servicoRemarcar(reservaParaRemarcar(), [slotLivre()]);
    const invertido = {
      ...pedido(),
      inicio: pedido().fim,
      fim: pedido().inicio,
    };

    await expect(s.remarcar("r1", "u1", invertido)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("reserva de outra pessoa não é remarcável: ela não existe para quem pede", async () => {
    const { servico: s } = servicoRemarcar(null, [slotLivre()]);
    await expect(s.remarcar("r-de-outro", "u1", pedido())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  /**
   * O desconto do Pix só vale para quem paga por Pix. No cartão, o preço do
   * novo horário entra inteiro — e era o lado da condição que nenhum teste
   * percorria, porque todas as fixtures pagavam por Pix.
   */
  it("no cartão, o novo horário não ganha o desconto do Pix", async () => {
    const noCartao = reservaParaRemarcar({
      pagamento: {
        id: "p1",
        status: PagamentoStatus.PENDENTE,
        metodo: PagamentoMetodo.CARTAO,
        valor: new Prisma.Decimal(80),
      },
    });
    const { servico: s, atualizaPagamento } = servicoRemarcar(noCartao, [slotLivre(120)]);

    await s.remarcar("r1", "u1", pedido());

    // 120 cheios, e não 114 (120 menos os 5% do Pix).
    expect(Number(atualizaPagamento.mock.calls[0][0].data.valor)).toBe(120);
  });
});

/** Um serviço só de leitura: `minhas` e `detalhe` não escrevem nada. */
function servicoDeLeitura(resultado: unknown, modo: "lista" | "um" = "lista") {
  const findMany = jest.fn().mockResolvedValue(resultado);
  const findFirst = jest.fn().mockResolvedValue(resultado);
  const prisma = {
    reserva: { findMany, findFirst },
  } as unknown as PrismaService;

  return {
    servico: new ReservasService(prisma, {} as QuadrasService, {} as PagamentosService),
    consulta: modo === "lista" ? findMany : findFirst,
  };
}

/**
 * As duas leituras do cliente — "Minhas reservas" e o detalhe de uma delas.
 *
 * **Nenhuma das duas era chamada por teste algum**, e as duas carregam uma
 * garantia que não se vê no retorno: o recorte da consulta. É ele que
 * impede a tela de mostrar bloqueio de quadra como se fosse reserva, e que
 * impede alguém de ler a reserva de outra pessoa trocando o id na URL.
 */
describe("ReservasService — as leituras do cliente", () => {
  it("“Minhas reservas” não mostra bloqueio de quadra", async () => {
    // `BLOQUEIO` é a linha que o gestor cria para fechar um horário. Ela
    // mora na mesma tabela e não é reserva de ninguém.
    const { servico: s, consulta } = servicoDeLeitura([]);

    await s.minhas("u1");

    const { where, orderBy, take } = consulta.mock.calls[0][0];
    expect(where.clienteId).toBe("u1");
    expect(where.status).toEqual({ not: ReservaStatus.BLOQUEIO });
    expect(orderBy).toEqual({ inicio: "desc" });
    expect(take).toBe(50);
  });

  it("a lista sai no contrato que o aplicativo consome", async () => {
    const comModalidades = {
      ...detalheCompleto(),
      quadra: {
        ...detalheCompleto().quadra,
        // A modalidade chega do Prisma como objeto e sai como nome: é o que
        // o cartão da tela mostra, e a lista vazia das outras fixtures
        // deixava essa conversão sem ninguém percorrer.
        modalidades: [{ nome: "Beach tennis" }, { nome: "Futevôlei" }],
      },
    };
    const { servico: s } = servicoDeLeitura([comModalidades]);

    const [r] = await s.minhas("u1");

    expect(r.id).toBe("r1");
    expect(r.preco).toBe(80);
    expect(r.quadra.nome).toBe("Quadra 1");
    expect(r.quadra.modalidades).toEqual(["Beach tennis", "Futevôlei"]);
  });

  it("reserva sem cobrança devolve pagamento nulo, e não um objeto vazio", async () => {
    // A tela decide o que mostrar olhando esse campo; um objeto sem valor
    // faria aparecer "a pagar" para uma reserva que nunca teve cobrança.
    const { servico: s } = servicoDeLeitura([detalheCompleto()]);
    expect((await s.minhas("u1"))[0].pagamento).toBeNull();
  });

  it("a cobrança, quando existe, sai com o valor em número", async () => {
    const comPagamento = {
      ...detalheCompleto(),
      pagamento: {
        id: "p1",
        status: PagamentoStatus.PENDENTE,
        metodo: PagamentoMetodo.PIX,
        valor: new Prisma.Decimal(72.5),
      },
    };
    const { servico: s } = servicoDeLeitura([comPagamento]);

    expect((await s.minhas("u1"))[0].pagamento?.valor).toBe(72.5);
  });

  /**
   * **O isolamento entre clientes mora na consulta.** O `where` casa id *e*
   * dono; trocar o id na URL não alcança a reserva de outra pessoa, e o que
   * ela recebe é 404 — a mesma resposta de um id que não existe, que é o que
   * evita confirmar "essa reserva existe, mas não é sua".
   */
  it("o detalhe de outra pessoa não existe para quem pede", async () => {
    const { servico: s, consulta } = servicoDeLeitura(null, "um");

    await expect(s.detalhe("r-de-outro", "u1")).rejects.toBeInstanceOf(NotFoundException);
    expect(consulta.mock.calls[0][0].where).toEqual({
      id: "r-de-outro",
      clienteId: "u1",
    });
  });

  it("o detalhe da própria reserva volta no contrato", async () => {
    const { servico: s } = servicoDeLeitura(detalheCompleto(), "um");

    const r = await s.detalhe("r1", "u1");

    expect(r.id).toBe("r1");
    expect(r.status).toBe(ReservaStatus.CANCELADA);
  });
});
