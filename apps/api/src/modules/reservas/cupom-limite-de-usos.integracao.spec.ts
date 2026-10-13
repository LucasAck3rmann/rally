// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrismaClient, Prisma, PromocaoTipo } from "@prisma/client";

import { ehCupomEsgotado } from "./reservas.service";

/**
 * Prova a restrição `promocao_usos_dentro_do_limite` contra um Postgres de
 * verdade (RN-14).
 *
 * Mock nenhum serve aqui: o que está sob teste é o **banco**. A conferência
 * que o serviço faz antes de criar a reserva serve para responder rápido e
 * explicar o motivo ao cliente — ela não garante nada, porque entre ler o
 * contador e gravar cabe outra requisição lendo o mesmo valor.
 *
 * Sem `DATABASE_URL` a suíte é pulada, para que `pnpm test` continue rodando
 * numa máquina sem banco; a CI levanta um Postgres e roda de fato.
 *
 * Exige o schema migrado e semeado:
 *   pnpm prisma migrate deploy && pnpm prisma db seed
 */
const comBanco = process.env.DATABASE_URL ? describe : describe.skip;

/** Prefixo dos ids criados aqui, para a limpeza não encostar no seed. */
const PREFIXO = "teste-cupom-";

comBanco("constraint promocao_usos_dentro_do_limite (integração)", () => {
  const prisma = new PrismaClient();
  let estabelecimentoId = "";

  async function criarCupom(sufixo: string, usosMax: number | null) {
    return prisma.promocao.create({
      data: {
        id: `${PREFIXO}${sufixo}`,
        estabelecimentoId,
        // O código também leva o prefixo: `@@unique([estabelecimentoId,
        // codigo])` impediria dois testes de usarem o mesmo texto.
        codigo: `${PREFIXO}${sufixo}`.toUpperCase(),
        tipo: PromocaoTipo.PERCENTUAL,
        valor: new Prisma.Decimal(10),
        validadeInicio: new Date("2030-01-01T00:00:00.000Z"),
        validadeFim: new Date("2030-12-31T23:59:59.000Z"),
        usosMax,
      },
    });
  }

  const usar = (id: string) =>
    prisma.promocao.update({
      where: { id },
      data: { usosFeitos: { increment: 1 } },
    });

  beforeAll(async () => {
    const quadra = await prisma.quadra.findFirstOrThrow();
    estabelecimentoId = quadra.estabelecimentoId;
  });

  afterEach(async () => {
    await prisma.promocao.deleteMany({ where: { id: { startsWith: PREFIXO } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("o uso que passa do limite é recusado pelo banco", async () => {
    const cupom = await criarCupom("limite-1", 1);

    await expect(usar(cupom.id)).resolves.toBeDefined();
    await expect(usar(cupom.id)).rejects.toThrow();
  });

  it("o erro da recusa é reconhecido como cupom esgotado, e não como falha", async () => {
    // É isto que vira 409 com mensagem útil em vez de 500 para o cliente.
    const cupom = await criarCupom("reconhece", 1);
    await usar(cupom.id);

    const erro = await usar(cupom.id).catch((e: unknown) => e);
    expect(ehCupomEsgotado(erro)).toBe(true);
  });

  it("sem limite declarado, o cupom não esgota", async () => {
    const cupom = await criarCupom("sem-limite", null);

    for (let i = 0; i < 5; i++) await usar(cupom.id);
    const depois = await prisma.promocao.findUniqueOrThrow({
      where: { id: cupom.id },
    });

    expect(depois.usosFeitos).toBe(5);
  });

  /**
   * A propriedade que a RN-14 pede, e não só o mecanismo.
   *
   * Vinte tentativas simultâneas num cupom de cinco usos precisam produzir
   * exatamente cinco — não "quase sempre cinco". Sem a restrição, as vinte
   * leem o mesmo contador, as vinte passam na conferência da aplicação, e o
   * cupom de cinco usos sai vinte.
   */
  it("sob corrida, o cupom entrega exatamente o número de usos que tem", async () => {
    const LIMITE = 5;
    const TENTATIVAS = 20;
    const cupom = await criarCupom("corrida", LIMITE);

    const resultados = await Promise.allSettled(
      Array.from({ length: TENTATIVAS }, () => usar(cupom.id)),
    );

    const ganharam = resultados.filter((r) => r.status === "fulfilled");
    const perderam = resultados.filter((r) => r.status === "rejected");

    expect(ganharam).toHaveLength(LIMITE);
    expect(perderam).toHaveLength(TENTATIVAS - LIMITE);

    const depois = await prisma.promocao.findUniqueOrThrow({
      where: { id: cupom.id },
    });
    expect(depois.usosFeitos).toBe(LIMITE);

    // E toda recusa precisa ser reconhecível como esgotamento: uma que não
    // fosse viraria 500 e esconderia o motivo de quem ficou de fora.
    for (const r of perderam) {
      expect(ehCupomEsgotado((r as PromiseRejectedResult).reason)).toBe(true);
    }
  });
});
