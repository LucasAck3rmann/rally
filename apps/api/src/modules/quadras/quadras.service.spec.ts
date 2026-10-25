// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { QuadrasService } from "./quadras.service";
import { ConciliacaoService } from "../conciliacao/conciliacao.service";

/** Terça-feira, 16/06/2026, 10:00 em São Paulo (UTC-3). */
const AGORA = new Date("2026-06-16T13:00:00.000Z");
const DIA = "2026-06-16";

function quadraBase(extras: Record<string, unknown> = {}) {
  return {
    id: "q1",
    precoHora: 80,
    faixasPreco: [],
    estabelecimento: {
      timezone: "America/Sao_Paulo",
      slotMinutos: 60,
      antecedenciaMinHoras: 1,
      antecedenciaMaxDias: 30,
      // Terça (2) abre 08:00 e fecha 12:00 → 4 slots de uma hora.
      horarios: [{ diaSemana: 2, abre: "08:00", fecha: "12:00" }],
    },
    ...extras,
  };
}

function servico(quadra: unknown, reservas: unknown[] = []) {
  const prisma = {
    quadra: { findFirst: jest.fn().mockResolvedValue(quadra) },
    reserva: { findMany: jest.fn().mockResolvedValue(reservas) },
  } as unknown as PrismaService;

  // A grade varre os Pix expirados antes de montar (RN-13). Aqui o dublê
  // não libera nada: os casos de expiração têm testes próprios no
  // `conciliacao.service.spec.ts`, e misturá-los aqui esconderia qual dos
  // dois comportamentos quebrou.
  const conciliacao = {
    expirarPendentes: jest.fn().mockResolvedValue(0),
  } as unknown as ConciliacaoService;

  return new QuadrasService(prisma, conciliacao);
}

describe("QuadrasService.disponibilidade", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it("gera um slot por passo dentro do funcionamento do dia", async () => {
    const { slots, slotMinutos } = await servico(quadraBase()).disponibilidade("q1", DIA);

    expect(slotMinutos).toBe(60);
    expect(slots.map((s) => s.hora)).toEqual(["08:00", "09:00", "10:00", "11:00"]);
    expect(slots[0].inicio).toBe("2026-06-16T11:00:00.000Z");
    expect(slots[0].fim).toBe("2026-06-16T12:00:00.000Z");
  });

  it("não devolve nada quando a quadra não abre no dia", async () => {
    const domingo = "2026-06-14";
    const { slots } = await servico(quadraBase()).disponibilidade("q1", domingo);
    expect(slots).toEqual([]);
  });

  it("bloqueia o horário que já tem reserva", async () => {
    const livre = await servico(quadraBase()).disponibilidade("q1", DIA);
    const ocupado = await servico(quadraBase(), [
      {
        inicio: new Date("2026-06-16T14:00:00.000Z"), // 11:00 local
        fim: new Date("2026-06-16T15:00:00.000Z"),
      },
    ]).disponibilidade("q1", DIA);

    const em = (grade: { slots: { hora: string; disponivel: boolean }[] }, hora: string) =>
      grade.slots.find((s) => s.hora === hora)!.disponivel;

    // O mesmo slot vira indisponível só por causa da reserva.
    expect(em(livre, "11:00")).toBe(true);
    expect(em(ocupado, "11:00")).toBe(false);
  });

  it("bloqueia o que já passou e o que está dentro da antecedência mínima", async () => {
    const { slots } = await servico(quadraBase()).disponibilidade("q1", DIA);
    const porHora = Object.fromEntries(slots.map((s) => [s.hora, s.disponivel]));

    // Agora são 10:00 com 1h de antecedência mínima:
    expect(porHora["08:00"]).toBe(false); // já passou
    expect(porHora["09:00"]).toBe(false); // já passou
    expect(porHora["10:00"]).toBe(false); // dentro da antecedência
    expect(porHora["11:00"]).toBe(true);
  });

  it("recusa datas além da antecedência máxima", async () => {
    const quadra = quadraBase();
    // Mesma terça, mas 60 dias à frente do limite de 30 dias.
    const { slots } = await servico(quadra).disponibilidade("q1", "2026-08-18");
    expect(slots.every((s) => !s.disponivel)).toBe(true);
  });

  it("usa a faixa de preço da hora e cai no preço-base fora dela", async () => {
    const quadra = quadraBase({
      faixasPreco: [{ diaSemana: null, horaInicio: "10:00", horaFim: "12:00", precoHora: 110 }],
    });
    const { slots } = await servico(quadra).disponibilidade("q1", DIA);
    const porHora = Object.fromEntries(slots.map((s) => [s.hora, s.preco]));

    expect(porHora["09:00"]).toBe(80);
    expect(porHora["10:00"]).toBe(110);
    expect(porHora["11:00"]).toBe(110);
  });

  it("cobra proporcional quando o slot é menor que uma hora", async () => {
    const quadra = quadraBase({
      estabelecimento: {
        ...quadraBase().estabelecimento,
        slotMinutos: 30,
      },
    });
    const { slots } = await servico(quadra).disponibilidade("q1", DIA);
    expect(slots).toHaveLength(8);
    expect(slots[0].preco).toBe(40);
  });

  /**
   * **O outro lado da condição do dia.** O teste acima usa faixa com
   * `diaSemana` nulo, que vale todo dia e encerra o `||` no primeiro operando
   * — o segundo nunca era avaliado. Faixa presa a um dia é o caso que o
   * gestor de fato cadastra ("sábado é mais caro"), e sem este par trocar o
   * `||` por `&&` passaria sem reprovar nada.
   */
  it("faixa presa a um dia vale naquele dia, e só nele", async () => {
    const TERCA = 2;
    const QUARTA = 3;

    const naTerca = quadraBase({
      faixasPreco: [{ diaSemana: TERCA, horaInicio: "10:00", horaFim: "12:00", precoHora: 150 }],
    });
    const deTerca = await servico(naTerca).disponibilidade("q1", DIA);
    const precoNaTerca = Object.fromEntries(deTerca.slots.map((s) => [s.hora, s.preco]));
    expect(precoNaTerca["09:00"]).toBe(80);
    expect(precoNaTerca["10:00"]).toBe(150);

    // A mesma faixa, cadastrada para quarta, não pode valer numa terça.
    const naQuarta = quadraBase({
      faixasPreco: [{ diaSemana: QUARTA, horaInicio: "10:00", horaFim: "12:00", precoHora: 150 }],
    });
    const deQuarta = await servico(naQuarta).disponibilidade("q1", DIA);
    const precoNaQuarta = Object.fromEntries(deQuarta.slots.map((s) => [s.hora, s.preco]));
    expect(precoNaQuarta["10:00"]).toBe(80);
  });

  it("quadra inexistente não devolve grade vazia: recusa", async () => {
    // Grade vazia diria "não abre hoje", que é outra coisa, e a tela trataria
    // o erro como dia fechado.
    await expect(servico(null).disponibilidade("sumiu", DIA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

/** Uma quadra como o `select` da vitrine a entrega, antes do achatamento. */
function quadraDaVitrine(extras: Record<string, unknown> = {}) {
  return {
    id: "q1",
    nome: "Quadra 1",
    precoHora: 80,
    fotos: ["q1.jpg"],
    capacidade: 4,
    modalidades: [{ nome: "Beach tennis" }],
    estabelecimento: {
      id: "e1",
      nome: "Arena Central",
      slug: "arena-central",
      bairro: "Centro",
      cidade: "Sapiranga",
      uf: "RS",
      nota: 4.5,
      avaliacoes: 12,
      descontoPixPct: 10,
    },
    ...extras,
  };
}

function servicoDeVitrine(quadras: unknown[], emJogo: { quadraId: string }[] = []) {
  const findMany = jest.fn().mockResolvedValue(quadras);
  const reservas = jest.fn().mockResolvedValue(emJogo);
  const prisma = {
    quadra: { findMany },
    reserva: { findMany: reservas },
  } as unknown as PrismaService;
  const conciliacao = {
    expirarPendentes: jest.fn().mockResolvedValue(0),
  } as unknown as ConciliacaoService;

  return { servico: new QuadrasService(prisma, conciliacao), findMany, reservas };
}

/**
 * A vitrine da Home do cliente (RF-05).
 *
 * **Este método não tinha teste nenhum** — sete funções sem execução e seis
 * ramos descobertos, numa tela que é a primeira que o jogador vê. O que ele
 * decide é o que aparece: quais quadras, filtradas por quê, e quais estão com
 * jogo acontecendo agora.
 */
describe("QuadrasService.listar — a vitrine da Home", () => {
  it("só mostra quadra ativa de estabelecimento ativo, ordenada e com teto", async () => {
    const { servico, findMany } = servicoDeVitrine([]);

    await servico.listar({});

    const consulta = findMany.mock.calls[0][0];
    expect(consulta.where.ativo).toBe(true);
    expect(consulta.where.estabelecimento).toEqual({ ativo: true });
    // Sem filtro, nada de `modalidades` nem `OR` sobra na consulta.
    expect(consulta.where.modalidades).toBeUndefined();
    expect(consulta.where.OR).toBeUndefined();
    expect(consulta.orderBy).toEqual([{ estabelecimento: { nome: "asc" } }, { nome: "asc" }]);
    expect(consulta.take).toBe(50);
  });

  it("o filtro de modalidade entra na consulta", async () => {
    const { servico, findMany } = servicoDeVitrine([]);

    await servico.listar({ modalidade: "Futevôlei" });

    expect(findMany.mock.calls[0][0].where.modalidades).toEqual({
      some: { nome: "Futevôlei" },
    });
  });

  /**
   * A busca procura em três lugares, e o bairro é um deles: quem digita
   * "Centro" está procurando onde jogar, não o nome de uma quadra.
   */
  it("a busca cobre nome da quadra, nome do estabelecimento e bairro", async () => {
    const { servico, findMany } = servicoDeVitrine([]);

    await servico.listar({ busca: "centro" });

    const ou = findMany.mock.calls[0][0].where.OR;
    expect(ou).toHaveLength(3);
    expect(ou[0]).toEqual({ nome: { contains: "centro", mode: "insensitive" } });
    expect(ou[1].estabelecimento.nome.contains).toBe("centro");
    expect(ou[2].estabelecimento.bairro.contains).toBe("centro");
  });

  it("busca só com espaço não vira filtro nenhum", async () => {
    // O `trim()` existe para isso, e sem teste ele some numa refatoração:
    // uma busca vazia filtrando por `""` casaria com tudo e pareceria certo.
    const { servico, findMany } = servicoDeVitrine([]);

    await servico.listar({ busca: "   " });

    expect(findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it("o selo “ao vivo” marca só a quadra com jogo neste momento", async () => {
    const { servico, reservas } = servicoDeVitrine(
      [quadraDaVitrine({ id: "q1" }), quadraDaVitrine({ id: "q2" })],
      [{ quadraId: "q2" }],
    );

    const lista = await servico.listar({});

    expect(lista.map((q) => [q.id, q.aoVivo])).toEqual([
      ["q1", false],
      ["q2", true],
    ]);
    // O "agora" é o instante da chamada, e não o dia: a consulta pega a
    // reserva que começou antes e ainda não acabou.
    const where = reservas.mock.calls[0][0].where;
    expect(where.inicio.lte).toBeInstanceOf(Date);
    expect(where.fim.gt).toBeInstanceOf(Date);
  });

  it("achata o formato do Prisma no contrato que o app consome", async () => {
    const { servico } = servicoDeVitrine([quadraDaVitrine()]);

    const [q] = await servico.listar({});

    expect(q.precoHora).toBe(80);
    expect(q.modalidades).toEqual(["Beach tennis"]);
    expect(q.estabelecimento.nota).toBe(4.5);
    expect(q.estabelecimento.descontoPixPct).toBe(10);
  });

  it("estabelecimento sem nota devolve nulo, e não zero", async () => {
    // Zero diria "avaliaram e é péssima"; nulo diz "ainda não avaliaram".
    const { servico } = servicoDeVitrine([
      quadraDaVitrine({
        estabelecimento: { ...quadraDaVitrine().estabelecimento, nota: null },
      }),
    ]);

    expect((await servico.listar({}))[0].estabelecimento.nota).toBeNull();
  });
});

describe("QuadrasService.detalhe", () => {
  it("quadra inexistente ou desativada é recusada", async () => {
    await expect(servico(null).detalhe("sumiu")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("devolve descrição e comodidades junto do resumo", async () => {
    const quadra = {
      ...quadraDaVitrine(),
      descricao: "Areia nova, rede oficial.",
      comodidades: ["Vestiário", "Estacionamento"],
    };

    const detalhe = await servico(quadra).detalhe("q1");

    expect(detalhe.nome).toBe("Quadra 1");
    expect(detalhe.descricao).toBe("Areia nova, rede oficial.");
    expect(detalhe.comodidades).toEqual(["Vestiário", "Estacionamento"]);
  });
});
