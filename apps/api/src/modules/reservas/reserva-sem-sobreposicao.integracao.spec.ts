// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrismaClient, Prisma, ReservaStatus } from "@prisma/client";

import { ehConflitoDeHorario } from "./reservas.service";

/**
 * Prova a `EXCLUDE USING gist` contra um Postgres de verdade (RN-01).
 *
 * Mock nenhum serve aqui: o que está sob teste é o **banco**, não o código.
 * Sem `DATABASE_URL` a suíte é pulada, para que `pnpm test` continue rodando
 * numa máquina sem banco; a CI levanta um Postgres e roda de fato.
 *
 * Exige o schema migrado e semeado:
 *   pnpm prisma migrate deploy && pnpm prisma db seed
 */
const comBanco = process.env.DATABASE_URL ? describe : describe.skip;

/** Prefixo dos ids criados aqui, para a limpeza não encostar no seed. */
const PREFIXO = "teste-sobrep-";

comBanco("constraint reserva_sem_sobreposicao (integração)", () => {
  const prisma = new PrismaClient();
  let quadraId = "";
  let estabelecimentoId = "";

  /** 2030 para nunca esbarrar no que o seed cria. */
  const as19 = new Date("2030-03-01T19:00:00.000Z");
  const as20 = new Date("2030-03-01T20:00:00.000Z");
  const as1930 = new Date("2030-03-01T19:30:00.000Z");
  const as2030 = new Date("2030-03-01T20:30:00.000Z");
  const as21 = new Date("2030-03-01T21:00:00.000Z");

  function reservar(sufixo: string, inicio: Date, fim: Date) {
    return prisma.reserva.create({
      data: {
        id: `${PREFIXO}${sufixo}`,
        estabelecimentoId,
        quadraId,
        inicio,
        fim,
        status: ReservaStatus.CONFIRMADA,
        preco: new Prisma.Decimal(80),
      },
    });
  }

  beforeAll(async () => {
    const quadra = await prisma.quadra.findFirstOrThrow();
    quadraId = quadra.id;
    estabelecimentoId = quadra.estabelecimentoId;
  });

  afterEach(async () => {
    await prisma.reserva.deleteMany({ where: { id: { startsWith: PREFIXO } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("recusa sobreposição parcial, que o índice único deixava passar", async () => {
    await reservar("base", as19, as20);

    // 19:30–20:30 tem início diferente de 19:00 — para o índice único isso
    // era outra linha, e a quadra acabava com dois jogos ao mesmo tempo.
    await expect(reservar("parcial", as1930, as2030)).rejects.toThrow();
  });

  it("aceita slots encostados, porque o intervalo é [início, fim)", async () => {
    await reservar("primeiro", as19, as20);
    await expect(reservar("segundo", as20, as21)).resolves.toBeDefined();
  });

  it("libera o horário depois do cancelamento", async () => {
    const original = await reservar("cancelada", as19, as20);
    await prisma.reserva.update({
      where: { id: original.id },
      data: { status: ReservaStatus.CANCELADA },
    });

    // Sem o predicado `status <> 'CANCELADA'`, a linha cancelada seguiria
    // ocupando o horário e ninguém mais conseguiria reservá-lo.
    await expect(reservar("nova", as19, as20)).resolves.toBeDefined();
  });

  it("na corrida por um slot, só uma reserva sobrevive", async () => {
    const [a, b] = await Promise.allSettled([
      reservar("corrida-a", as19, as20),
      reservar("corrida-b", as19, as20),
    ]);

    const ganhou = [a, b].filter((r) => r.status === "fulfilled");
    const perdeu = [a, b].filter((r) => r.status === "rejected");

    expect(ganhou).toHaveLength(1);
    expect(perdeu).toHaveLength(1);
    // E o erro de quem perdeu precisa ser reconhecido como conflito de
    // horário — é isso que vira 409 em vez de 500 para o cliente.
    const motivo = (perdeu[0] as PromiseRejectedResult).reason;
    expect(ehConflitoDeHorario(motivo)).toBe(true);
  });
});
