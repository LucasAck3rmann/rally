// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrismaClient, Prisma, RecorrenciaStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { RecorrenciasService } from "./recorrencias.service";

/**
 * Prova contra um Postgres de verdade que a semana ocupada **é pulada**, e
 * não estourada (RF-36, ADR-0014).
 *
 * **O que mock nenhum alcança aqui é o erro.** O `materializar` decide entre
 * pular e relançar chamando `ehConflitoDeHorario`, que examina a exceção que
 * o banco levanta. O teste de unidade fabrica essa exceção — uma `Error`
 * comum com a frase em inglês *"conflicting key value violates exclusion
 * constraint"* — e por isso ele passaria **mesmo que a exceção real fosse
 * outra coisa**. Se fosse, uma série que encontra uma semana ocupada não
 * pularia: estouraria inteira, e o comportamento central do ADR-0014 não
 * existiria.
 *
 * Medido em 19/10/2026 contra o PostgreSQL 18 desta máquina: a exceção chega
 * como `PrismaClientUnknownRequestError`, **sem `code`**, e a mensagem vem no
 * idioma do servidor — *"valor-chave conflitante viola a restrição de
 * exclusão"*. A detecção sobrevive porque procura o **nome da restrição**, e
 * não a frase; um detector escrito contra o texto em inglês teria falhado
 * calado neste servidor, e o teste de unidade continuaria verde. É isso que
 * esta suíte prende.
 *
 * Sem `DATABASE_URL` é pulada, para `pnpm test` seguir rodando sem banco; a
 * CI levanta um Postgres e roda de fato.
 */
const comBanco = process.env.DATABASE_URL ? describe : describe.skip;

/** Prefixo dos ids criados aqui, para a limpeza não encostar no seed. */
const PREFIXO = "teste-mensalista-";

comBanco("mensalista pula a semana ocupada (integração)", () => {
  const prisma = new PrismaClient();
  const servico = new RecorrenciasService(prisma as unknown as PrismaService);

  let quadraId = "";
  let estabelecimentoId = "";
  let clienteId = "";
  let serieId = "";

  /** Terça-feira, 5 de março de 2030 — longe do que o seed cria. */
  const PRIMEIRA_TERCA = "2030-03-05";
  const AGORA = new Date("2030-03-04T12:00:00.000Z");
  const HORA = "19:00";

  beforeAll(async () => {
    const quadra = await prisma.quadra.findFirstOrThrow();
    quadraId = quadra.id;
    estabelecimentoId = quadra.estabelecimentoId;
    clienteId = (await prisma.usuario.findFirstOrThrow()).id;
  });

  beforeEach(async () => {
    const serie = await prisma.recorrencia.create({
      data: {
        id: `${PREFIXO}serie`,
        estabelecimentoId,
        quadraId,
        clienteId,
        diaSemana: 2,
        horaInicio: HORA,
        duracaoMinutos: 60,
        vigenciaInicio: new Date(`${PRIMEIRA_TERCA}T00:00:00.000Z`),
        preco: new Prisma.Decimal(70),
      },
      select: { id: true },
    });
    serieId = serie.id;
  });

  afterEach(async () => {
    await prisma.reserva.deleteMany({ where: { id: { startsWith: PREFIXO } } });
    await prisma.reserva.deleteMany({ where: { recorrenciaId: serieId } });
    await prisma.recorrencia.deleteMany({ where: { id: { startsWith: PREFIXO } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** O instante UTC de uma terça às 19h no fuso do estabelecimento. */
  async function as19(data: string) {
    const { timezone } = await prisma.estabelecimento.findFirstOrThrow({
      where: { id: estabelecimentoId },
      select: { timezone: true },
    });
    // -03:00 o ano inteiro desde 2019, que é o fuso do seed. O teste afirma
    // o fuso em vez de supô-lo, para falhar com clareza se ele mudar.
    expect(timezone).toBe("America/Sao_Paulo");
    return new Date(`${data}T22:00:00.000Z`);
  }

  it("a semana ocupada é pulada, e as outras entram", async () => {
    // Uma reserva de balcão ocupa a primeira terça da série.
    await prisma.reserva.create({
      data: {
        id: `${PREFIXO}ocupa`,
        estabelecimentoId,
        quadraId,
        clienteId,
        inicio: await as19(PRIMEIRA_TERCA),
        fim: new Date((await as19(PRIMEIRA_TERCA)).getTime() + 60 * 60_000),
        status: ReservaStatus.CONFIRMADA,
        preco: new Prisma.Decimal(80),
      },
    });

    const r = await servico.materializar(serieId, AGORA);

    // **Pulou, não estourou.** Se `ehConflitoDeHorario` deixasse de
    // reconhecer a exceção real, este `await` rejeitaria e o ADR-0014 não
    // teria o comportamento que declarou.
    expect(r.puladas).toEqual([
      { data: PRIMEIRA_TERCA, motivo: "o horário já estava ocupado nessa semana" },
    ]);
    expect(r.criadas).toBeGreaterThan(0);

    const ocorrencias = await prisma.reserva.findMany({
      where: { recorrenciaId: serieId },
      select: { inicio: true },
      orderBy: { inicio: "asc" },
    });
    // Nenhuma ocorrência caiu na semana ocupada.
    const naSemanaOcupada = ocorrencias.filter(
      (o) => o.inicio.toISOString().slice(0, 10) === PRIMEIRA_TERCA,
    );
    expect(naSemanaOcupada).toEqual([]);
    // E todas caem numa terça, espaçadas de sete dias.
    for (const o of ocorrencias) expect(o.inicio.getUTCDay()).toBe(2);
  });

  it("a semana pulada não avança `materializadaAte`", async () => {
    // Se avançasse, uma colisão na última semana do horizonte faria o
    // sistema achar que materializou até lá, e a semana seguinte nunca seria
    // tentada — o horário ficaria livre com dono, em silêncio.
    await prisma.reserva.create({
      data: {
        id: `${PREFIXO}ocupa`,
        estabelecimentoId,
        quadraId,
        clienteId,
        inicio: await as19(PRIMEIRA_TERCA),
        fim: new Date((await as19(PRIMEIRA_TERCA)).getTime() + 60 * 60_000),
        status: ReservaStatus.CONFIRMADA,
        preco: new Prisma.Decimal(80),
      },
    });

    await servico.materializar(serieId, AGORA);

    const serie = await prisma.recorrencia.findFirstOrThrow({
      where: { id: serieId },
      select: { materializadaAte: true },
    });
    expect(serie.materializadaAte).not.toBeNull();
    expect(serie.materializadaAte!.toISOString().slice(0, 10)).not.toBe(
      PRIMEIRA_TERCA,
    );
  });

  it("rodar de novo não duplica ocorrência", async () => {
    // A segunda volta encontra tudo materializado. Se ela recriasse, cada
    // tentativa esbarraria na própria série e o relatório de colisão viraria
    // ruído — além de o trabalho diário crescer sem limite.
    const primeira = await servico.materializar(serieId, AGORA);
    const segunda = await servico.materializar(serieId, AGORA);

    expect(primeira.criadas).toBeGreaterThan(0);
    expect(segunda.criadas).toBe(0);
    expect(segunda.puladas).toEqual([]);

    const total = await prisma.reserva.count({ where: { recorrenciaId: serieId } });
    expect(total).toBe(primeira.criadas);
  });

  it("estenderHorizonte acha a série pendente e a materializa", async () => {
    // O filtro do trabalho diário é SQL de verdade — `OR` com `null` e `AND`
    // aninhado. Mock nenhum confere se o Prisma o compila.
    const r = await servico.estenderHorizonte(AGORA);

    expect(r.series).toBeGreaterThan(0);
    expect(r.falhas).toBe(0);
    const total = await prisma.reserva.count({ where: { recorrenciaId: serieId } });
    expect(total).toBeGreaterThan(0);
  });

  it("série encerrada não entra no horizonte", async () => {
    await prisma.recorrencia.update({
      where: { id: serieId },
      data: { status: RecorrenciaStatus.ENCERRADA },
    });

    await servico.estenderHorizonte(AGORA);

    const total = await prisma.reserva.count({ where: { recorrenciaId: serieId } });
    expect(total).toBe(0);
  });
});
