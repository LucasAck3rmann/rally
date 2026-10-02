// SPDX-License-Identifier: AGPL-3.0-or-later
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
});
