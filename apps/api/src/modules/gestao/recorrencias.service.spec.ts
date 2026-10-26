// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma, RecorrenciaStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { RecorrenciasService, SEMANAS_DE_HORIZONTE } from "./recorrencias.service";

/** Terça-feira, 20 de outubro de 2026. */
const AGORA = new Date("2026-10-20T12:00:00.000Z");
const TERCA = 2;

function serieBase(extras: Record<string, unknown> = {}) {
  return {
    id: "s1",
    estabelecimentoId: "e1",
    quadraId: "q1",
    clienteId: "u1",
    diaSemana: TERCA,
    horaInicio: "19:00",
    duracaoMinutos: 60,
    vigenciaInicio: new Date("2026-10-01T00:00:00.000Z"),
    vigenciaFim: null,
    preco: new Prisma.Decimal(90),
    status: RecorrenciaStatus.ATIVA,
    materializadaAte: null,
    observacao: null,
    quadra: { nome: "Quadra 1" },
    cliente: { nome: "Augusto Boff", email: "augusto@rally.com.br" },
    estabelecimento: { timezone: "America/Sao_Paulo" },
    ...extras,
  };
}

/** Erro que o Postgres devolve quando a restrição de exclusão recusa. */
function conflito() {
  return new Error(
    'conflicting key value violates exclusion constraint "reserva_sem_sobreposicao"',
  );
}

function servico(
  opcoes: {
    serie?: unknown;
    quadra?: unknown;
    cliente?: unknown;
    /** Datas (YYYY-MM-DD) em que a criação deve falhar por conflito. */
    conflitamEm?: string[];
  } = {},
) {
  const conflitamEm = new Set(opcoes.conflitamEm ?? []);
  const criadas: { inicio: Date; fim: Date; preco: unknown; status: string }[] = [];

  const criarReserva = jest.fn(async ({ data }: { data: Record<string, never> }) => {
    const d = data as unknown as { inicio: Date };
    if (conflitamEm.has(d.inicio.toISOString().slice(0, 10))) throw conflito();
    criadas.push(data as never);
    return { id: `r${criadas.length}` };
  });
  const atualizarSerie = jest.fn().mockResolvedValue(serieBase());
  const criarSerie = jest.fn().mockResolvedValue(opcoes.serie ?? serieBase());
  const cancelarMuitas = jest.fn().mockResolvedValue({ count: 3 });

  const acharSeries = jest.fn().mockResolvedValue([serieBase()]);
  const acharUsuario = jest
    .fn()
    .mockResolvedValue(opcoes.cliente === undefined ? { id: "u1" } : opcoes.cliente);

  const prisma = {
    recorrencia: {
      // `"serie" in opcoes` e nao `?? serieBase()`: o `??` transforma o `null`
      // deliberado do teste na serie padrao, e o caso "nao achou" nunca seria
      // exercitado. Mesmo defeito do `user: undefined` de 14/10.
      findUnique: jest.fn().mockResolvedValue("serie" in opcoes ? opcoes.serie : serieBase()),
      findFirst: jest.fn().mockResolvedValue("serie" in opcoes ? opcoes.serie : serieBase()),
      findMany: acharSeries,
      create: criarSerie,
      update: atualizarSerie,
    },
    quadra: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opcoes.quadra === undefined ? { id: "q1" } : opcoes.quadra),
    },
    usuario: { findUnique: acharUsuario },
    reserva: { create: criarReserva, updateMany: cancelarMuitas },
  } as unknown as PrismaService;

  return {
    servico: new RecorrenciasService(prisma),
    prisma,
    criadas,
    criarReserva,
    criarSerie,
    atualizarSerie,
    cancelarMuitas,
    acharUsuario,
    acharSeries,
  };
}

describe("RecorrenciasService — mensalistas (ADR-0014)", () => {
  describe("materializar", () => {
    it("cria uma ocorrência por semana até o horizonte", async () => {
      const { servico: s, criadas } = servico();

      const r = await s.materializar("e1", "s1", AGORA);

      // Nove, e nao oito: o horizonte de 8 semanas a partir de uma terca
      // **inclui as duas pontas**. O numero de ocorrencias depende de onde
      // hoje cai na semana, e por isso o teste afirma a faixa e o espacamento
      // em vez de um numero magico.
      expect(r.criadas).toBeGreaterThanOrEqual(SEMANAS_DE_HORIZONTE);
      expect(r.criadas).toBeLessThanOrEqual(SEMANAS_DE_HORIZONTE + 1);
      expect(r.puladas).toEqual([]);
      // Toda ocorrência cai numa terça-feira.
      for (const c of criadas) expect(c.inicio.getUTCDay()).toBe(TERCA);
      // E espaçadas de exatamente sete dias.
      for (let i = 1; i < criadas.length; i++) {
        const dias = (criadas[i].inicio.getTime() - criadas[i - 1].inicio.getTime()) / 86_400_000;
        expect(dias).toBe(7);
      }
    });

    it("a ocorrência nasce confirmada, e não pendente de pagamento", async () => {
      // **Pendente seria errado de um jeito que só apareceria semanas depois:**
      // a expiração automática de Pix liberaria o horário do mensalista.
      const { servico: s, criadas } = servico();

      await s.materializar("e1", "s1", AGORA);

      expect(criadas[0].status).toBe(ReservaStatus.CONFIRMADA);
    });

    it("congela o preço da série em cada reserva (RN-12)", async () => {
      const { servico: s, criadas } = servico();

      await s.materializar("e1", "s1", AGORA);

      expect(Number(criadas[0].preco)).toBe(90);
    });

    it("semana ocupada é pulada e reportada, e as outras seguem", async () => {
      // Recusar a série inteira transformaria um conflito de uma semana em
      // bloqueio de meses, e o gestor resolveria fora do sistema.
      const { servico: s } = servico({ conflitamEm: ["2026-10-27"] });

      const r = await s.materializar("e1", "s1", AGORA);

      expect(r.criadas).toBe(SEMANAS_DE_HORIZONTE);
      expect(r.puladas).toEqual([
        { data: "2026-10-27", motivo: "o horário já estava ocupado nessa semana" },
      ]);
    });

    it("a semana pulada não avança `materializadaAte`", async () => {
      // **É o caso que esconde o defeito.** Se a semana pulada avançasse o
      // marcador, uma colisão na última semana do horizonte faria o sistema
      // achar que materializou até lá — e a semana seguinte nunca seria
      // tentada, deixando um buraco permanente na agenda do mensalista.
      const ultima = "2026-12-15"; // a última terça dentro do horizonte
      const { servico: s, atualizarSerie } = servico({ conflitamEm: [ultima] });

      await s.materializar("e1", "s1", AGORA);

      const gravado = atualizarSerie.mock.calls[0][0].data.materializadaAte;
      expect(gravado.toISOString().slice(0, 10)).not.toBe(ultima);
      expect(gravado.toISOString().slice(0, 10)).toBe("2026-12-08");
    });

    it("não cria ocorrência cujo horário de hoje já passou", async () => {
      // **Defeito achado pelo próprio teste, em 17/10.** O dia pode ser hoje e
      // o horário já ter acontecido: uma série das 19h materializada às 20h
      // geraria uma reserva no passado, que entraria no relatório como receita
      // de um jogo que ninguém jogou — e o gestor fecharia o mês com um número
      // que não aconteceu.
      const tercaDeNoite = new Date("2026-10-20T23:00:00.000Z"); // 20h em SP
      const { servico: s, criadas } = servico();

      await s.materializar("e1", "s1", tercaDeNoite);

      expect(criadas.every((c) => c.inicio > tercaDeNoite)).toBe(true);
      expect(criadas.map((c) => c.inicio.toISOString().slice(0, 10))).not.toContain("2026-10-20");
    });

    it("não refaz o que já estava materializado", async () => {
      const { servico: s, criadas } = servico({
        serie: serieBase({ materializadaAte: new Date("2026-11-03T22:00:00.000Z") }),
      });

      await s.materializar("e1", "s1", AGORA);

      for (const c of criadas) {
        expect(c.inicio.toISOString().slice(0, 10) > "2026-11-03").toBe(true);
      }
    });

    it("respeita o fim da vigência", async () => {
      const { servico: s } = servico({
        serie: serieBase({ vigenciaFim: new Date("2026-11-10T00:00:00.000Z") }),
      });

      const r = await s.materializar("e1", "s1", AGORA);

      // 20/10, 27/10, 03/11 e 10/11 — quatro terças até o fim da vigência.
      // A de 20/10 entra porque as 19h locais ainda não passaram às 12h UTC.
      expect(r.criadas).toBe(4);
    });

    it("série encerrada não gera mais nada", async () => {
      const { servico: s, criarReserva } = servico({
        serie: serieBase({ status: RecorrenciaStatus.ENCERRADA }),
      });

      const r = await s.materializar("e1", "s1", AGORA);

      expect(r).toEqual({ criadas: 0, puladas: [] });
      expect(criarReserva).not.toHaveBeenCalled();
    });

    it("erro que não é conflito de horário sobe", async () => {
      // Engolir qualquer erro aqui faria uma falha de banco parecer "semana
      // ocupada", e o gestor procuraria uma reserva que não existe.
      const prisma = {
        recorrencia: {
          // Os dois: o `achar` confere a arena com `findFirst`, e o trabalho
          // em si relê a série com `findUnique` para levar o fuso junto.
          findFirst: jest.fn().mockResolvedValue(serieBase()),
          findUnique: jest.fn().mockResolvedValue(serieBase()),
        },
        reserva: {
          create: jest.fn().mockRejectedValue(new Error("conexão caiu")),
        },
      } as unknown as PrismaService;

      await expect(new RecorrenciasService(prisma).materializar("e1", "s1", AGORA)).rejects.toThrow(
        "conexão caiu",
      );
    });
  });

  describe("criar", () => {
    it("recusa quadra de outro estabelecimento", async () => {
      // Sem esta conferência, um admin criaria mensalista na quadra de outra
      // arena passando o id — é o mesmo cuidado do bloqueio de horário.
      const { servico: s } = servico({ quadra: null });

      await expect(
        s.criar("e1", {
          quadraId: "q-de-outra",
          clienteEmail: "augusto@rally.com.br",
          diaSemana: TERCA,
          horaInicio: "19:00",
          duracaoMinutos: 60,
          vigenciaInicio: "2026-10-01",
          preco: 90,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("recusa cliente inexistente", async () => {
      const { servico: s } = servico({ cliente: null });

      await expect(
        s.criar("e1", {
          quadraId: "q1",
          clienteEmail: "fantasma@rally.com.br",
          diaSemana: TERCA,
          horaInicio: "19:00",
          duracaoMinutos: 60,
          vigenciaInicio: "2026-10-01",
          preco: 90,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("acha o cliente pelo e-mail normalizado e guarda o id, não o e-mail", async () => {
      // Dois defeitos moram aqui, e os dois passariam pelo compilador porque
      // e-mail e id são os dois `string`.
      //
      // O primeiro: e-mail digitado com espaço ou em maiúscula não acha
      // ninguém, e a recusa diria "não tem conta no Rally" para quem tem — o
      // gestor concluiria que o cliente precisa se cadastrar de novo.
      //
      // O segundo: gravar o e-mail onde vai o id deixa a série apontando para
      // um cliente que não existe. A chave estrangeira recusaria, mas só na
      // hora de materializar a primeira ocorrência, longe de onde o erro foi
      // cometido e já dentro de uma transação que não explica o motivo.
      const { servico: s, criarSerie, acharUsuario } = servico();

      await s.criar("e1", {
        quadraId: "q1",
        clienteEmail: "  Augusto@Rally.com.BR  ",
        diaSemana: TERCA,
        horaInicio: "19:00",
        duracaoMinutos: 60,
        vigenciaInicio: "2026-10-01",
        preco: 90,
      });

      expect(acharUsuario).toHaveBeenCalledWith({
        where: { email: "augusto@rally.com.br" },
        select: { id: true },
      });
      const criada = criarSerie.mock.calls[0][0] as {
        data: { clienteId: string };
      };
      expect(criada.data.clienteId).toBe("u1");
    });

    it("recusa vigência que termina antes de começar", async () => {
      const { servico: s } = servico();

      await expect(
        s.criar("e1", {
          quadraId: "q1",
          clienteEmail: "augusto@rally.com.br",
          diaSemana: TERCA,
          horaInicio: "19:00",
          duracaoMinutos: 60,
          vigenciaInicio: "2026-12-01",
          vigenciaFim: "2026-11-01",
          preco: 90,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("estenderHorizonte", () => {
    it("a falha de uma série não interrompe as outras", async () => {
      // **É a propriedade decisiva deste trabalho agendado.** Quadra removida,
      // cliente anonimizado pela LGPD ou erro de banco numa série fazem a
      // volta dela falhar. Abortar ali deixaria **todas as séries seguintes
      // da lista** sem materializar, em silêncio, e o defeito apareceria
      // semanas depois como horário livre que tem dono.
      const { servico: s, acharSeries } = servico();
      acharSeries.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
      // Espia o **trabalho**, e nao o `materializar` publico: o publico
      // confere a arena antes, e o trabalho agendado varre todas as arenas
      // por natureza, de modo que nao e por ele que o job passa.
      const trabalho = s as unknown as {
        materializarSerie: (id: string, agora?: Date) => Promise<unknown>;
      };
      const materializar = jest
        .spyOn(trabalho, "materializarSerie")
        .mockResolvedValueOnce({ criadas: 9, puladas: [] })
        .mockRejectedValueOnce(new Error("quadra removida"))
        .mockResolvedValueOnce({
          criadas: 8,
          puladas: [{ data: "2026-11-03", motivo: "o horário já estava ocupado" }],
        });

      const r = await s.estenderHorizonte(AGORA);

      // A terceira foi tentada **depois** de a segunda estourar.
      expect(materializar).toHaveBeenCalledTimes(3);
      expect(materializar).toHaveBeenLastCalledWith("s3", AGORA);
      expect(r).toEqual({ series: 3, criadas: 17, puladas: 1, falhas: 1 });
    });

    it("só busca série ativa, não cheia e com vigência em pé", async () => {
      // Série encerrada, série já materializada até o horizonte e série cuja
      // vigência acabou não geram nada. Trazê-las seria pagar a consulta, uma
      // vez por dia para sempre, para descobrir isso de novo.
      const { servico: s, acharSeries } = servico();
      acharSeries.mockResolvedValueOnce([]);
      jest.spyOn(s, "materializar");

      await s.estenderHorizonte(AGORA);

      const onde = acharSeries.mock.calls[0][0].where as {
        status: RecorrenciaStatus;
        OR: { materializadaAte: null | { lt: Date } }[];
        AND: { OR: { vigenciaFim: null | { gte: Date } }[] }[];
      };
      expect(onde.status).toBe(RecorrenciaStatus.ATIVA);
      // O limite é o mesmo horizonte que o `materializar` usa. Um número
      // diferente aqui faria o filtro pular série que o materializar ainda
      // estenderia — e a série ficaria parada sem ninguém saber por quê.
      const esperado = new Date(AGORA);
      esperado.setUTCDate(esperado.getUTCDate() + SEMANAS_DE_HORIZONTE * 7);
      expect(onde.OR).toEqual([{ materializadaAte: null }, { materializadaAte: { lt: esperado } }]);
      expect(onde.AND).toEqual([{ OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: AGORA } }] }]);
    });

    it("sem série pendente, não chama o materializar nenhuma vez", async () => {
      const { servico: s, acharSeries } = servico();
      acharSeries.mockResolvedValueOnce([]);
      const materializar = jest.spyOn(
        s as unknown as { materializarSerie: (id: string) => Promise<unknown> },
        "materializarSerie",
      );

      const r = await s.estenderHorizonte(AGORA);

      expect(materializar).not.toHaveBeenCalled();
      expect(r).toEqual({ series: 0, criadas: 0, puladas: 0, falhas: 0 });
    });
  });

  describe("encerrar", () => {
    it("cancela as ocorrências futuras e preserva as passadas", async () => {
      // As passadas são o histórico que o relatório usa para fechar o mês;
      // apagá-las mudaria a receita de um período já encerrado.
      const { servico: s, cancelarMuitas } = servico();

      const r = await s.encerrar("e1", "s1", AGORA);

      expect(r.canceladas).toBe(3);
      const where = cancelarMuitas.mock.calls[0][0].where;
      expect(where.recorrenciaId).toBe("s1");
      expect(where.inicio.gte).toEqual(AGORA);
      const dados = cancelarMuitas.mock.calls[0][0].data;
      expect(dados.status).toBe(ReservaStatus.CANCELADA);
      expect(dados.motivoCancelamento).toContain("Mensalidade");
    });

    it("recusa série de outro estabelecimento", async () => {
      const { servico: s } = servico({ serie: null });

      await expect(s.encerrar("e1", "s1", AGORA)).rejects.toThrow(NotFoundException);
    });

    it("sem o instante, usa o relógio — é como o controlador chama", async () => {
      // O `agora` existe para o teste poder fixar o tempo; em produção
      // ninguém o passa, e esse caminho não era percorrido.
      const { servico: s, cancelarMuitas } = servico();

      await s.encerrar("e1", "s1");

      expect(cancelarMuitas.mock.calls[0][0].where.inicio.gte).toBeInstanceOf(Date);
    });
  });

  describe("os caminhos que o relógio e o id decidem", () => {
    it("materializar série inexistente é 404, e não zero ocorrências", async () => {
      // Zero ocorrências diria "não havia o que criar", que é o retorno de
      // uma série encerrada. São duas respostas para duas situações.
      const { servico: s } = servico({ serie: null });

      await expect(s.materializar("e1", "sumiu", AGORA)).rejects.toThrow(NotFoundException);
    });

    it("materializar procura a série **dentro** do estabelecimento da rota", async () => {
      // O defeito que esta asserção fixa: a rota recebia só o id da série e o
      // serviço fazia `findUnique({ where: { id } })`, sem arena. Um admin da
      // arena A materializava a série da arena B passando o id dela — o
      // `PapelGuard` aprova pelo papel em A, que é real, e as reservas caíam
      // na agenda de B.
      //
      // A asserção é sobre a **consulta**, e não sobre o retorno: um teste
      // que só checasse o 404 passaria com um `findUnique` sem escopo, porque
      // o id inexistente devolve nulo de qualquer jeito.
      const { servico: s, prisma } = servico();

      await s.materializar("e1", "s1", AGORA);

      const procura = (prisma.recorrencia.findFirst as jest.Mock).mock.calls[0][0];
      expect(procura.where).toEqual({ id: "s1", estabelecimentoId: "e1" });
    });

    it("materializar sem o instante usa o relógio — é como o controlador chama", async () => {
      // O `agora` existe para o teste fixar o tempo. A rota não o passa, de
      // modo que o padrão é o caminho de produção, e não o excepcional.
      const { servico: s, criadas } = servico();

      const r = await s.materializar("e1", "s1");

      expect(r.criadas).toBeGreaterThan(0);
      expect(criadas[0].inicio.getTime()).toBeGreaterThan(Date.now());
    });

    it("série que some entre a conferência e o trabalho é 404, e não estouro", async () => {
      // **Por que a guarda de dentro não é redundante.** O `materializar`
      // confere a arena com `findFirst`, e o trabalho relê a série com
      // `findUnique` para levar o fuso junto. São duas consultas, e entre elas
      // a série pode ser apagada — pelo encerramento em outra sessão, ou pela
      // exclusão de conta do cliente.
      //
      // Depois que o escopo passou a ser conferido antes, esta é a **única**
      // forma de alcançar aquele `throw`: sem este teste ele pareceria código
      // morto, e alguém o tiraria.
      const { servico: s, prisma } = servico();
      (prisma.recorrencia.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(s.materializar("e1", "s1", AGORA)).rejects.toThrow(
        new NotFoundException("Série não encontrada."),
      );
    });

    it("série de outra arena é 404, e não confirma que existe", async () => {
      // "Não encontrada", igual ao id inexistente: distinguir as duas
      // respostas contaria a quem perguntou que aquela série existe em
      // **alguma** arena, que é informação a que ele não tem direito.
      const { servico: s, prisma } = servico();
      (prisma.recorrencia.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(s.materializar("arena-alheia", "s1", AGORA)).rejects.toThrow(
        new NotFoundException("Série não encontrada."),
      );
    });

    it("estenderHorizonte sem o instante usa o relógio", async () => {
      // O trabalho diário o chama sem argumento; o `agora` existe para o
      // teste fixar o tempo, e esse caminho não era percorrido.
      const { servico: s, prisma } = servico();

      const r = await s.estenderHorizonte();

      expect(r.series).toBeGreaterThan(0);
      const where = (prisma.recorrencia.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.OR[1].materializadaAte.lt).toBeInstanceOf(Date);
    });
  });

  describe("listar", () => {
    it("traz só as séries do estabelecimento da rota", async () => {
      // O painel de mensalistas é por arena. Sem o recorte, o id na URL
      // mostraria a carteira de clientes de outra.
      const { servico: s, acharSeries } = servico();

      await s.listar("e1");

      expect(acharSeries.mock.calls[0][0].where).toEqual({ estabelecimentoId: "e1" });
    });

    it("ordena por situação, depois por dia e hora", async () => {
      // Ativa antes de encerrada, e dentro disso na ordem da semana: é como
      // a tela lê, e ordenar no banco evita a lista mudar de ordem sozinha.
      const { servico: s, acharSeries } = servico();

      await s.listar("e1");

      expect(acharSeries.mock.calls[0][0].orderBy).toEqual([
        { status: "asc" },
        { diaSemana: "asc" },
        { horaInicio: "asc" },
      ]);
    });

    it("devolve no contrato da tela, com o preço em número", async () => {
      const { servico: s } = servico();

      const [serie] = await s.listar("e1");

      expect(serie.id).toBe("s1");
      expect(serie.preco).toBe(90);
      expect(serie.quadra).toBe("Quadra 1");
    });
  });

  describe("editar", () => {
    it("série de outro estabelecimento não é editável", async () => {
      const { servico: s } = servico({ serie: null });

      await expect(s.editar("e1", "s1", { preco: 100 })).rejects.toThrow(NotFoundException);
    });

    /**
     * **O que não foi enviado não é tocado.** O `editar` monta o `data` com
     * três condicionais, e cada uma tem dois lados: campo presente e campo
     * ausente. Sem este par, um `??` no lugar do `!== undefined` passaria —
     * e aí mandar `observacao: ""` apagaria a observação achando que era
     * "não enviou".
     */
    it("muda só o que veio no pedido", async () => {
      const { servico: s, atualizarSerie } = servico();

      await s.editar("e1", "s1", { preco: 120 });

      const { data } = atualizarSerie.mock.calls[0][0];
      expect(Number(data.preco)).toBe(120);
      expect("vigenciaFim" in data).toBe(false);
      expect("observacao" in data).toBe(false);
    });

    it("os três campos juntos entram juntos", async () => {
      const { servico: s, atualizarSerie } = servico();

      await s.editar("e1", "s1", {
        preco: 150,
        vigenciaFim: "2026-12-31",
        observacao: "paga no dia 5",
      });

      const { data } = atualizarSerie.mock.calls[0][0];
      expect(Number(data.preco)).toBe(150);
      expect(data.vigenciaFim).toEqual(new Date("2026-12-31T00:00:00.000Z"));
      expect(data.observacao).toBe("paga no dia 5");
    });

    /**
     * A vigência é **data**, não instante: o serviço corta a hora para que
     * "31/12" não vire "31/12 às 21h" conforme o fuso de quem enviou.
     */
    it("aceita data com hora, e guarda só o dia", async () => {
      const { servico: s, atualizarSerie } = servico();

      await s.editar("e1", "s1", { vigenciaFim: "2026-12-31T18:30:00.000Z" });

      expect(atualizarSerie.mock.calls[0][0].data.vigenciaFim).toEqual(
        new Date("2026-12-31T00:00:00.000Z"),
      );
    });

    it("data impossível é recusada com o nome do campo", async () => {
      const { servico: s, atualizarSerie } = servico();

      await expect(s.editar("e1", "s1", { vigenciaFim: "31/12/2026" })).rejects.toThrow(
        /vigenciaFim/,
      );
      expect(atualizarSerie).not.toHaveBeenCalled();
    });
  });
});
