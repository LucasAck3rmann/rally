// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrismaClient, Prisma, ReservaStatus } from "@prisma/client";

import { ehConflitoDeHorario, ehImpasseDeHorario } from "./reservas.service";

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

/**
 * **Prazo de arquivo, porque aqui nada é teste de unidade.**
 *
 * O teste de carga faz vinte inserções simultâneas pelo mesmo intervalo, e a
 * restrição de exclusão as serializa; com o banco disputado pelas outras
 * suítes de integração em paralelo, o conjunto passa dos 5 s que o Jest dá
 * por omissão. Foi visto falhar por tempo com a afirmação — "exatamente uma
 * linha" — intacta, e **o `afterAll` estourou em cascata**, o que derruba a
 * suíte inteira. Por isso o prazo vale para todo o arquivo, ganchos
 * incluídos, e não só para o teste que mais demora.
 *
 * Portão que falha por relógio é reexecutado sem ninguém olhar, e este é o
 * portão da garantia central do projeto. O prazo maior não enfraquece nada:
 * a conta conferida no banco continua a mesma.
 */
jest.setTimeout(30_000);

/**
 * Descreve um erro em uma linha, para a asserção poder nomeá-lo.
 *
 * A natureza do erro é o que decide se o cliente vê 409 ou 500, e é
 * justamente o que se perde quando a asserção compara só um booleano.
 */
/**
 * O rótulo da derrota, ou a descrição do erro que não é uma derrota prevista.
 *
 * **Perder a disputa tem duas formas, e as duas viram 409.** A violação da
 * restrição de exclusão prova que o intervalo está ocupado; o impasse
 * (`40P01`) prova apenas que esta transação foi abortada para desfazer um
 * ciclo de espera. Qualquer coisa fora dessas duas chega ao cliente como 500,
 * e é isso que este portão existe para impedir.
 */
function derrota(erro: unknown): string {
  if (ehConflitoDeHorario(erro)) return "derrota prevista";
  if (ehImpasseDeHorario(erro)) return "derrota prevista";
  return descrever(erro);
}

function descrever(erro: unknown): string {
  if (!(erro instanceof Error)) return `não-erro: ${String(erro)}`;
  const codigo = (erro as { code?: string }).code ?? "sem code";
  // **A cauda, e não o começo.** O Prisma prefixa a mensagem com o trecho do
  // código que fez a chamada — umas duzentas colunas de moldura antes de
  // chegar ao que o banco disse. Cortar pelo começo descreveria a moldura.
  const mensagem = erro.message.replace(/\s+/g, " ").slice(-260);
  return `${erro.constructor.name} (${codigo}): …${mensagem}`;
}

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

  /** 2030-03-01 na hora cheia indicada, em UTC. */
  function hora(h: number) {
    return new Date(`2030-03-01T${String(h).padStart(2, "0")}:00:00.000Z`);
  }

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

    // **Limpeza na entrada, e não só na saída.** Execução interrompida não
    // roda `afterEach`, e a sobra colide com o próprio passado: dois dos três
    // testes criam 19h–20h na mesma quadra, de modo que uma linha esquecida
    // faz o **primeiro** `create` ser recusado pela restrição de exclusão. O
    // erro então acusa 23P01 numa inserção que deveria passar, e o portão da
    // garantia central do projeto vira "instabilidade" reexecutada sem olhar.
    await prisma.reserva.deleteMany({ where: { id: { startsWith: PREFIXO } } });
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
    expect(derrota(motivo)).toBe("derrota prevista");
  });

  /**
   * RNF-03: "zero overbooking sob reservas simultâneas".
   *
   * A corrida de duas vias acima prova o mecanismo; esta prova a **propriedade
   * sob carga**, que é o que o requisito pede. Vinte tentativas simultâneas
   * pelo mesmo horário precisam produzir exatamente uma reserva — não "quase
   * sempre uma".
   */
  it("sob carga, n clientes disputando o mesmo slot produzem exatamente uma reserva", async () => {
    const TENTATIVAS = 20;

    const resultados = await Promise.allSettled(
      Array.from({ length: TENTATIVAS }, (_, i) => reservar(`carga-${i}`, as19, as20)),
    );

    const ganharam = resultados.filter((r) => r.status === "fulfilled");
    const perderam = resultados.filter((r) => r.status === "rejected");

    expect(ganharam).toHaveLength(1);
    expect(perderam).toHaveLength(TENTATIVAS - 1);

    // Nenhuma derrota pode chegar ao cliente como 500: todas precisam ser
    // derrota prevista, que é o que os caminhos interativos convertem em 409.
    //
    // **Foi aqui que o impasse apareceu.** Em cerca de uma execução em cinco,
    // uma das dezenove derrotas chegava como `40P01` — e a asserção anterior,
    // que comparava um booleano, dizia só "Expected: true, Received: false".
    // Sem nomear o erro, a falha passava por instabilidade e era
    // reexecutada; a asserção agora carrega a descrição, de modo que a
    // próxima surpresa chega nomeada.
    for (const perdida of perderam) {
      const motivo = (perdida as PromiseRejectedResult).reason;
      expect(derrota(motivo)).toBe("derrota prevista");
    }

    // A prova final é no banco, não no resultado das promessas: é ele que
    // decide se houve overbooking.
    const gravadas = await prisma.reserva.count({
      where: {
        quadraId,
        inicio: as19,
        status: { not: ReservaStatus.CANCELADA },
      },
    });
    expect(gravadas).toBe(1);
  });

  /**
   * Contraprova. Recusar a disputa pelo mesmo horário é fácil de acertar de
   * um jeito errado: um lock de tabela também "resolveria" o overbooking, e
   * serializaria a agenda inteira. Se alguém trocar a constraint por algo
   * assim, este teste é o que cai.
   */
  it("horários diferentes não se bloqueiam sob concorrência", async () => {
    const horarios = [8, 9, 10, 11, 12, 13].map((h) => [hora(h), hora(h + 1)]);

    const resultados = await Promise.allSettled(
      horarios.map(([inicio, fim], i) => reservar(`paralelo-${i}`, inicio, fim)),
    );

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(horarios.length);
  });
});
