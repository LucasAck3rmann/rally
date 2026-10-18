// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma, RecorrenciaStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  RecorrenciasService,
  SEMANAS_DE_HORIZONTE,
} from "./recorrencias.service";

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
  const cancelarMuitas = jest.fn().mockResolvedValue({ count: 3 });

  const prisma = {
    recorrencia: {
      // `"serie" in opcoes` e nao `?? serieBase()`: o `??` transforma o `null`
      // deliberado do teste na serie padrao, e o caso "nao achou" nunca seria
      // exercitado. Mesmo defeito do `user: undefined` de 14/10.
      findUnique: jest
        .fn()
        .mockResolvedValue("serie" in opcoes ? opcoes.serie : serieBase()),
      findFirst: jest
        .fn()
        .mockResolvedValue("serie" in opcoes ? opcoes.serie : serieBase()),
      findMany: jest.fn().mockResolvedValue([serieBase()]),
      create: jest.fn().mockResolvedValue(opcoes.serie ?? serieBase()),
      update: atualizarSerie,
    },
    quadra: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.quadra === undefined ? { id: "q1" } : opcoes.quadra,
        ),
    },
    usuario: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opcoes.cliente === undefined ? { id: "u1" } : opcoes.cliente,
        ),
    },
    reserva: { create: criarReserva, updateMany: cancelarMuitas },
  } as unknown as PrismaService;

  return {
    servico: new RecorrenciasService(prisma),
    prisma,
    criadas,
    criarReserva,
    atualizarSerie,
    cancelarMuitas,
  };
}

describe("RecorrenciasService — mensalistas (ADR-0014)", () => {
  describe("materializar", () => {
    it("cria uma ocorrência por semana até o horizonte", async () => {
      const { servico: s, criadas } = servico();

      const r = await s.materializar("s1", AGORA);

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
        const dias =
          (criadas[i].inicio.getTime() - criadas[i - 1].inicio.getTime()) /
          86_400_000;
        expect(dias).toBe(7);
      }
    });

    it("a ocorrência nasce confirmada, e não pendente de pagamento", async () => {
      // **Pendente seria errado de um jeito que só apareceria semanas depois:**
      // a expiração automática de Pix liberaria o horário do mensalista.
      const { servico: s, criadas } = servico();

      await s.materializar("s1", AGORA);

      expect(criadas[0].status).toBe(ReservaStatus.CONFIRMADA);
    });

    it("congela o preço da série em cada reserva (RN-12)", async () => {
      const { servico: s, criadas } = servico();

      await s.materializar("s1", AGORA);

      expect(Number(criadas[0].preco)).toBe(90);
    });

    it("semana ocupada é pulada e reportada, e as outras seguem", async () => {
      // Recusar a série inteira transformaria um conflito de uma semana em
      // bloqueio de meses, e o gestor resolveria fora do sistema.
      const { servico: s } = servico({ conflitamEm: ["2026-10-27"] });

      const r = await s.materializar("s1", AGORA);

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

      await s.materializar("s1", AGORA);

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

      await s.materializar("s1", tercaDeNoite);

      expect(criadas.every((c) => c.inicio > tercaDeNoite)).toBe(true);
      expect(
        criadas.map((c) => c.inicio.toISOString().slice(0, 10)),
      ).not.toContain("2026-10-20");
    });

    it("não refaz o que já estava materializado", async () => {
      const { servico: s, criadas } = servico({
        serie: serieBase({ materializadaAte: new Date("2026-11-03T22:00:00.000Z") }),
      });

      await s.materializar("s1", AGORA);

      for (const c of criadas) {
        expect(c.inicio.toISOString().slice(0, 10) > "2026-11-03").toBe(true);
      }
    });

    it("respeita o fim da vigência", async () => {
      const { servico: s } = servico({
        serie: serieBase({ vigenciaFim: new Date("2026-11-10T00:00:00.000Z") }),
      });

      const r = await s.materializar("s1", AGORA);

      // 20/10, 27/10, 03/11 e 10/11 — quatro terças até o fim da vigência.
      // A de 20/10 entra porque as 19h locais ainda não passaram às 12h UTC.
      expect(r.criadas).toBe(4);
    });

    it("série encerrada não gera mais nada", async () => {
      const { servico: s, criarReserva } = servico({
        serie: serieBase({ status: RecorrenciaStatus.ENCERRADA }),
      });

      const r = await s.materializar("s1", AGORA);

      expect(r).toEqual({ criadas: 0, puladas: [] });
      expect(criarReserva).not.toHaveBeenCalled();
    });

    it("erro que não é conflito de horário sobe", async () => {
      // Engolir qualquer erro aqui faria uma falha de banco parecer "semana
      // ocupada", e o gestor procuraria uma reserva que não existe.
      const prisma = {
        recorrencia: { findUnique: jest.fn().mockResolvedValue(serieBase()) },
        reserva: {
          create: jest.fn().mockRejectedValue(new Error("conexão caiu")),
        },
      } as unknown as PrismaService;

      await expect(
        new RecorrenciasService(prisma).materializar("s1", AGORA),
      ).rejects.toThrow("conexão caiu");
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
          clienteId: "u1",
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
          clienteId: "fantasma",
          diaSemana: TERCA,
          horaInicio: "19:00",
          duracaoMinutos: 60,
          vigenciaInicio: "2026-10-01",
          preco: 90,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("recusa vigência que termina antes de começar", async () => {
      const { servico: s } = servico();

      await expect(
        s.criar("e1", {
          quadraId: "q1",
          clienteId: "u1",
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

      await expect(s.encerrar("e1", "s1", AGORA)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
