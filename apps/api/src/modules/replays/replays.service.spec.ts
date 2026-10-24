// SPDX-License-Identifier: AGPL-3.0-or-later
import { ReplayStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { ReplaysService } from "./replays.service";

/**
 * Os clipes do cliente, e os filtros da tela de Replays (RF-23).
 *
 * **Este serviço estava com 0% de cobertura de ramos**, como o de promoções:
 * sete decisões e nenhuma percorrida. As decisões não são cosméticas — elas
 * respondem *quais* clipes a pessoa vê.
 *
 * Duas delas merecem destaque. A janela do período é o que os chips da tela
 * fazem, e uma janela errada mostra clipe que não deveria aparecer ou esconde
 * o que deveria. E o recorte da consulta decide que só clipe **pronto**, do
 * **próprio** cliente e **não expirado** sai daqui: errar ali é vazar clipe
 * de outra pessoa ou entregar link morto.
 */
describe("ReplaysService — os clipes do cliente", () => {
  const findMany = jest.fn();
  const prisma = { replay: { findMany } } as unknown as PrismaService;
  const service = new ReplaysService(prisma);

  beforeEach(() => jest.clearAllMocks());

  const DIA = 24 * 60 * 60 * 1000;

  /** Um clipe pronto, com os campos que o `select` do serviço pede. */
  function clipe(mudancas: Record<string, unknown> = {}) {
    return {
      id: "rep-1",
      url: "https://midia.rally.app/rep-1.mp4",
      duracaoSeg: 42,
      criadoEm: new Date("2026-10-20T18:00:00.000Z"),
      quadra: {
        nome: "Quadra 1",
        fotos: ["https://midia.rally.app/q1.jpg"],
        estabelecimento: { nome: "Arena Central", timezone: "America/Sao_Paulo" },
      },
      ...mudancas,
    };
  }

  /** O `where` da única consulta que o serviço faz. */
  function filtro() {
    return findMany.mock.calls[0][0].where;
  }

  it("“todos” não filtra por data nenhuma", async () => {
    findMany.mockResolvedValueOnce([]);

    await service.meus("u1", "todos");

    expect(filtro().criadoEm).toBeUndefined();
  });

  it("“semana” olha os últimos sete dias", async () => {
    findMany.mockResolvedValueOnce([]);
    const antes = Date.now();

    await service.meus("u1", "semana");

    const desde = filtro().criadoEm.gte as Date;
    // Comparação por janela, e não por igualdade: o serviço usa o relógio.
    expect(desde.getTime()).toBeGreaterThanOrEqual(antes - 7 * DIA - 5_000);
    expect(desde.getTime()).toBeLessThanOrEqual(Date.now() - 7 * DIA + 5_000);
  });

  it("“mes” olha os últimos trinta dias, e não os sete da semana", async () => {
    findMany.mockResolvedValueOnce([]);
    const antes = Date.now();

    await service.meus("u1", "mes");

    const desde = filtro().criadoEm.gte as Date;
    expect(desde.getTime()).toBeGreaterThanOrEqual(antes - 30 * DIA - 5_000);
    expect(desde.getTime()).toBeLessThanOrEqual(Date.now() - 30 * DIA + 5_000);
  });

  /**
   * Três condições numa consulta só, e cada uma impede um estrago diferente:
   * clipe de outra pessoa, clipe ainda processando e link já vencido.
   */
  it("só traz clipe pronto, do próprio cliente e não expirado", async () => {
    findMany.mockResolvedValueOnce([]);

    await service.meus("u-dono", "todos");

    const where = filtro();
    expect(where.clienteId).toBe("u-dono");
    expect(where.status).toBe(ReplayStatus.PRONTO);
    expect(where.OR[0]).toEqual({ expiraEm: null });
    expect(where.OR[1].expiraEm.gt).toBeInstanceOf(Date);
  });

  it("a quadra sem foto não inventa miniatura", async () => {
    findMany.mockResolvedValueOnce([
      clipe({
        quadra: {
          nome: "Quadra 2",
          fotos: [],
          estabelecimento: { nome: "Arena", timezone: "America/Sao_Paulo" },
        },
      }),
    ]);

    expect((await service.meus("u1", "todos"))[0].thumbUrl).toBeNull();
  });

  it("a quadra com fotos usa a primeira como miniatura", async () => {
    findMany.mockResolvedValueOnce([
      clipe({
        quadra: {
          nome: "Quadra 3",
          fotos: ["primeira.jpg", "segunda.jpg"],
          estabelecimento: { nome: "Arena", timezone: "America/Sao_Paulo" },
        },
      }),
    ]);

    expect((await service.meus("u1", "todos"))[0].thumbUrl).toBe("primeira.jpg");
  });

  it("o clipe sai no formato que a tela consome", async () => {
    findMany.mockResolvedValueOnce([clipe()]);

    const [r] = await service.meus("u1", "todos");

    expect(r).toEqual({
      id: "rep-1",
      // Enquanto não há edição, o título é o nome da quadra — está dito no
      // serviço, e é aqui que a afirmação fica presa.
      titulo: "Quadra 1",
      url: "https://midia.rally.app/rep-1.mp4",
      thumbUrl: "https://midia.rally.app/q1.jpg",
      duracaoSeg: 42,
      criadoEm: "2026-10-20T18:00:00.000Z",
      estabelecimento: "Arena Central",
    });
  });
});
