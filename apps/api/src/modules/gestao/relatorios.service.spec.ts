// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PagamentoMetodo, PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";
import ExcelJS from "exceljs";

import { PrismaService } from "../../prisma/prisma.service";
import { textoDoPdf } from "./ler-pdf.spec-helper";
import { diasEntre, RelatoriosService } from "./relatorios.service";

/** Todos os dias, 8h–22h: 14 horas por dia. */
const HORARIOS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  diaSemana: d,
  abre: "08:00",
  fecha: "22:00",
}));

function reserva(
  opcoes: {
    dia?: string;
    horas?: number;
    preco?: number;
    status?: ReservaStatus;
    metodo?: PagamentoMetodo | null;
    pago?: boolean;
    quadraId?: string;
  } = {},
) {
  // 22:00 UTC = 19:00 em Sao_Paulo.
  const inicio = new Date(`${opcoes.dia ?? "2026-09-10"}T22:00:00.000Z`);
  return {
    inicio,
    fim: new Date(inicio.getTime() + (opcoes.horas ?? 1) * 3_600_000),
    status: opcoes.status ?? ReservaStatus.CONFIRMADA,
    preco: new Prisma.Decimal(opcoes.preco ?? 80),
    quadraId: opcoes.quadraId ?? "q1",
    quadra: { nome: opcoes.quadraId === "q2" ? "Quadra 2" : "Quadra 1" },
    pagamento:
      opcoes.metodo === null
        ? null
        : {
            status: opcoes.pago === false ? PagamentoStatus.PENDENTE : PagamentoStatus.PAGO,
            metodo: opcoes.metodo ?? PagamentoMetodo.PIX,
          },
  };
}

function servico(
  opcoes: {
    estabelecimento?: unknown;
    reservas?: unknown[];
    quadras?: unknown[];
  } = {},
) {
  const prisma = {
    estabelecimento: {
      findUnique: jest.fn().mockResolvedValue(
        opcoes.estabelecimento === undefined
          ? {
              nome: "Arena Beach Sapiranga",
              timezone: "America/Sao_Paulo",
              horarios: HORARIOS,
            }
          : opcoes.estabelecimento,
      ),
    },
    quadra: {
      findMany: jest.fn().mockResolvedValue(
        // `modalidades` entra no padrão porque a consulta real sempre a
        // traz: fixture sem ela deixaria o agrupamento por modalidade
        // passar num teste e quebrar em produção.
        (opcoes.quadras ?? [{ id: "q1", nome: "Quadra 1" }]).map(
          (q: { id: string; nome: string; modalidades?: { nome: string }[] }) => ({
            modalidades: [],
            ...q,
          }),
        ),
      ),
    },
    reserva: { findMany: jest.fn().mockResolvedValue(opcoes.reservas ?? []) },
  } as unknown as PrismaService & Record<string, never>;

  return { servico: new RelatoriosService(prisma), prisma };
}

/**
 * Lê a planilha de volta.
 *
 * O `as never` existe por desencontro de tipos entre o `Buffer` do
 * `@types/node` 22 e o que o `exceljs` declara — em tempo de execução é o
 * mesmo objeto. Isolado aqui para o `as` não se espalhar pelos testes.
 */
async function abrirPlanilha(conteudo: Buffer): Promise<ExcelJS.Workbook> {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(conteudo as never);
  return livro;
}

describe("RelatoriosService", () => {
  describe("período", () => {
    it("conta as duas pontas", () => {
      expect(diasEntre("2026-09-10", "2026-09-10")).toBe(1);
      expect(diasEntre("2026-09-10", "2026-09-16")).toBe(7);
      // Atravessa a virada do mês e o ano bissexto.
      expect(diasEntre("2026-10-31", "2026-11-01")).toBe(2);
      expect(diasEntre("2028-02-28", "2028-03-01")).toBe(3);
    });

    it("recusa data fora do formato", async () => {
      const { servico: s } = servico();
      await expect(s.relatorio("e1", "10/09/2026", "2026-09-16")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("recusa início depois do fim", async () => {
      const { servico: s } = servico();
      await expect(s.relatorio("e1", "2026-09-20", "2026-09-10")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("recusa período maior que um ano", async () => {
      // Sem teto, um pedido de dez anos varre a tabela inteira.
      const { servico: s } = servico();
      await expect(s.relatorio("e1", "2020-01-01", "2026-01-01")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("estabelecimento inexistente é 404", async () => {
      const { servico: s } = servico({ estabelecimento: null });
      await expect(s.relatorio("e9", "2026-09-10", "2026-09-10")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("por método de pagamento (RF-27)", () => {
    it("separa Pix, cartão e balcão", async () => {
      const { servico: s } = servico({
        reservas: [
          reserva({ preco: 100, metodo: PagamentoMetodo.PIX }),
          reserva({ preco: 60, metodo: PagamentoMetodo.CARTAO }),
          // Reserva sem pagamento é venda de balcão, feita na arena.
          reserva({ preco: 40, metodo: null }),
        ],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      expect(r.porMetodo.map((m) => m.metodo)).toEqual(["Pix", "Cartão", "Balcão"]);
      expect(r.porMetodo[0]).toMatchObject({ valor: 100, participacao: 50 });
    });

    it("a soma dos métodos fecha com a receita total", async () => {
      // Deixar o balcão de fora faria o relatório não fechar — e relatório
      // que não fecha não se usa.
      const { servico: s } = servico({
        reservas: [
          reserva({ preco: 100, metodo: PagamentoMetodo.PIX }),
          reserva({ preco: 40, metodo: null }),
        ],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      const soma = r.porMetodo.reduce((s2, m) => s2 + m.valor, 0);
      expect(soma).toBe(r.resumo.receitaTotal);
    });

    it("ordena pelo valor, do maior para o menor", async () => {
      const { servico: s } = servico({
        reservas: [
          reserva({ preco: 10, metodo: PagamentoMetodo.PIX }),
          reserva({ preco: 90, metodo: PagamentoMetodo.CARTAO }),
        ],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");
      expect(r.porMetodo[0].metodo).toBe("Cartão");
    });

    it("sem venda, a participação é nula e não zero", async () => {
      const { servico: s } = servico();
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");
      expect(r.porMetodo).toEqual([]);
      expect(r.resumo.ticketMedio).toBeNull();
    });
  });

  describe("série diária", () => {
    it("tem uma linha por dia do período", async () => {
      const { servico: s } = servico();
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-16");
      expect(r.porDia).toHaveLength(7);
      expect(r.porDia[0].data).toBe("2026-09-10");
      expect(r.porDia[6].data).toBe("2026-09-16");
    });

    it("dia sem movimento aparece com zero, e não fora da lista", async () => {
      // Um gráfico que pula a quarta vazia mente sobre a forma da semana —
      // e é justamente o dia morto que o dono precisa ver.
      const { servico: s } = servico({
        reservas: [reserva({ dia: "2026-09-12" })],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-12");

      expect(r.porDia.map((d) => d.reservas)).toEqual([0, 0, 1]);
      expect(r.porDia[0].receita).toBe(0);
    });

    it("agrupa pelo dia no fuso do estabelecimento", async () => {
      // 2026-09-11T02:00Z é dia 10 às 23h em São Paulo. Agrupar por UTC
      // jogaria a reserva para o dia seguinte e furaria o fechamento.
      const { servico: s } = servico({
        reservas: [
          {
            ...reserva(),
            inicio: new Date("2026-09-11T02:00:00.000Z"),
            fim: new Date("2026-09-11T03:00:00.000Z"),
          },
        ],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-11");

      expect(r.porDia[0]).toMatchObject({ data: "2026-09-10", reservas: 1 });
      expect(r.porDia[1].reservas).toBe(0);
    });

    it("a ocupação do dia usa a porta aberta daquele dia", async () => {
      const { servico: s } = servico({
        reservas: [reserva({ horas: 7 })],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");
      // 7h vendidas em 14h de porta aberta, uma quadra = 50%.
      expect(r.porDia[0].ocupacao).toBe(50);
    });

    it("sem horário cadastrado, a ocupação do dia é nula", async () => {
      const { servico: s } = servico({
        estabelecimento: {
          nome: "Arena",
          timezone: "America/Sao_Paulo",
          horarios: [],
        },
        reservas: [reserva()],
      });
      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      expect(r.porDia[0].ocupacao).toBeNull();
      expect(r.resumo.ocupacao).toBeNull();
    });
  });

  describe("csv (RF-28)", () => {
    it("nomeia o arquivo com o período", async () => {
      // Três relatórios na pasta de downloads com o mesmo nome não se
      // distinguem.
      const { servico: s } = servico();
      const { arquivo } = await s.csv("e1", "2026-09-10", "2026-09-16");
      expect(arquivo).toBe("rally-relatorio-2026-09-10-a-2026-09-16.csv");
    });

    it("leva BOM, separador ponto e vírgula e vírgula decimal", async () => {
      const { servico: s } = servico({
        reservas: [reserva({ preco: 1234.5, metodo: PagamentoMetodo.PIX })],
      });
      const { conteudo } = await s.csv("e1", "2026-09-10", "2026-09-10");

      expect(conteudo.startsWith("﻿")).toBe(true);
      expect(conteudo).toContain("Receita recebida;1234,50");
      expect(conteudo).toContain("Pix;1;1234,50;100,0");
    });

    it("protege o nome de quadra que contém o separador", async () => {
      const { servico: s } = servico({
        quadras: [{ id: "q1", nome: "Quadra 1; coberta" }],
        reservas: [reserva()],
      });
      const { conteudo } = await s.csv("e1", "2026-09-10", "2026-09-10");
      expect(conteudo).toContain('"Quadra 1; coberta"');
    });

    it("ocupação sem denominador vira célula vazia, não zero", async () => {
      const { servico: s } = servico({
        estabelecimento: { nome: "Arena", timezone: "America/Sao_Paulo", horarios: [] },
        reservas: [reserva()],
      });
      const { conteudo } = await s.csv("e1", "2026-09-10", "2026-09-10");
      expect(conteudo).toContain("Ocupação (%);\r\n");
    });
  });

  describe("por modalidade (RF-28)", () => {
    /**
     * A pergunta veio do campo livre do Instrumento I, escrita por um gestor:
     * *"qual esporte que mais tem procura"*. O relatório respondia por quadra
     * e por dia, e não por modalidade.
     */
    const comModalidades = [
      { id: "q1", nome: "Quadra 1", modalidades: [{ nome: "Beach Tennis" }] },
      {
        id: "q2",
        nome: "Quadra 2",
        modalidades: [{ nome: "Beach Tennis" }, { nome: "Futevôlei" }],
      },
    ];

    it("agrupa receita e horas por modalidade", async () => {
      const { servico: s } = servico({
        quadras: comModalidades,
        reservas: [reserva({ quadraId: "q1", preco: 100 })],
      });

      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      expect(r.porModalidade).toEqual([
        { modalidade: "Beach Tennis", reservas: 1, horas: 1, receita: 100, quadras: 1 },
      ]);
    });

    it("quadra de duas modalidades conta nas duas, e os valores não somam o total", () => {
      // **É da natureza do dado, não defeito.** A reserva registra a quadra,
      // não o esporte jogado. Dividir a receita entre as modalidades daria
      // números que somam bonito e que nenhum gestor poderia conferir.
      return servico({
        quadras: comModalidades,
        reservas: [reserva({ quadraId: "q2", preco: 80 })],
      })
        .servico.relatorio("e1", "2026-09-10", "2026-09-10")
        .then((r) => {
          expect(r.porModalidade.map((m) => m.modalidade).sort()).toEqual([
            "Beach Tennis",
            "Futevôlei",
          ]);
          for (const m of r.porModalidade) expect(m.receita).toBe(80);
          // A soma das modalidades (160) excede a receita real (80).
          const soma = r.porModalidade.reduce((t, m) => t + m.receita, 0);
          expect(soma).toBeGreaterThan(r.resumo.receitaTotal);
        });
    });

    it('quadra sem modalidade cadastrada vira "Não informada", e não some', async () => {
      // Receita que desaparece de um relatório é pior que receita numa linha
      // sem nome: o gestor conferiria o total e não fecharia.
      const { servico: s } = servico({
        quadras: [{ id: "q1", nome: "Quadra 1", modalidades: [] }],
        reservas: [reserva({ quadraId: "q1", preco: 50 })],
      });

      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      expect(r.porModalidade).toEqual([
        { modalidade: "Não informada", reservas: 1, horas: 1, receita: 50, quadras: 1 },
      ]);
    });

    it("ordena pela receita, da maior para a menor", async () => {
      const { servico: s } = servico({
        quadras: comModalidades,
        reservas: [reserva({ quadraId: "q1", preco: 30 }), reserva({ quadraId: "q2", preco: 200 })],
      });

      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      expect(r.porModalidade[0].modalidade).toBe("Beach Tennis");
      expect(r.porModalidade[0].receita).toBe(230);
      expect(r.porModalidade[0].quadras).toBe(2);
    });

    it("quadra ativa sem reserva no período não cria linha vazia", async () => {
      const { servico: s } = servico({ quadras: comModalidades, reservas: [] });

      const r = await s.relatorio("e1", "2026-09-10", "2026-09-10");

      expect(r.porModalidade).toEqual([]);
    });
  });

  describe("xlsx (RF-28)", () => {
    it("nomeia o arquivo com o período e a extensão certa", async () => {
      const { servico: s } = servico();
      const { arquivo } = await s.xlsx("e1", "2026-09-10", "2026-09-16");
      expect(arquivo).toBe("rally-relatorio-2026-09-10-a-2026-09-16.xlsx");
    });

    it("gera um arquivo que o Excel reconhece", async () => {
      // `.xlsx` é um zip: os dois primeiros bytes são "PK". Sem essa
      // conferência, um buffer vazio passaria como planilha válida.
      const { servico: s } = servico();
      const { conteudo } = await s.xlsx("e1", "2026-09-10", "2026-09-10");

      expect(conteudo.length).toBeGreaterThan(1000);
      expect(conteudo.subarray(0, 2).toString("latin1")).toBe("PK");
    });

    it("grava número como número, não como texto", async () => {
      // É a razão de o XLSX existir ao lado do CSV: aqui a célula já é
      // numérica, soma e entra em gráfico sem ninguém converter nada.
      const { servico: s } = servico({
        reservas: [reserva({ preco: 1234.5, metodo: PagamentoMetodo.PIX })],
      });
      const { conteudo } = await s.xlsx("e1", "2026-09-10", "2026-09-10");

      const lido = await abrirPlanilha(conteudo);
      const metodos = lido.getWorksheet("Por método")!;
      const valor = metodos.getCell("C2").value;

      expect(typeof valor).toBe("number");
      expect(valor).toBe(1234.5);
    });

    it("grava data como data, não como string", async () => {
      // Só assim a planilha ordena e agrupa por data.
      const { servico: s } = servico();
      const { conteudo } = await s.xlsx("e1", "2026-09-10", "2026-09-10");

      const lido = await abrirPlanilha(conteudo);
      const dias = lido.getWorksheet("Dia por dia")!;

      expect(dias.getCell("A2").value).toBeInstanceOf(Date);
    });

    it("a aba de modalidade traz a ressalva de que os valores não somam", async () => {
      // Quem recebe a planilha por e-mail não recebe a tela junto, e somaria
      // a coluna de receita. A ressalva precisa viajar dentro do arquivo.
      const { servico: s } = servico();
      const { conteudo } = await s.xlsx("e1", "2026-09-10", "2026-09-10");

      const lido = await abrirPlanilha(conteudo);
      const aba = lido.getWorksheet("Por modalidade")!;
      const textos: string[] = [];
      aba.eachRow((linha) => textos.push(String(linha.getCell(1).value ?? "")));
      expect(textos.some((t) => t.includes("não somam o total"))).toBe(true);
    });

    it("tem uma aba por seção do relatório", async () => {
      const { servico: s } = servico();
      const { conteudo } = await s.xlsx("e1", "2026-09-10", "2026-09-10");

      const lido = await abrirPlanilha(conteudo);
      expect(lido.worksheets.map((a) => a.name)).toEqual([
        "Resumo",
        "Por método",
        "Dia por dia",
        "Por quadra",
        "Por modalidade",
      ]);
    });

    it("congela o cabeçalho de cada aba", async () => {
      // Numa série de 90 dias, rolar perde o nome da coluna e a planilha
      // deixa de se explicar.
      const { servico: s } = servico();
      const { conteudo } = await s.xlsx("e1", "2026-09-10", "2026-09-10");

      const lido = await abrirPlanilha(conteudo);
      for (const aba of lido.worksheets) {
        expect(aba.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
      }
    });

    it("recusa período inválido antes de montar a planilha", async () => {
      const { servico: s } = servico();
      await expect(s.xlsx("e1", "2026-09-20", "2026-09-10")).rejects.toThrow(BadRequestException);
    });
  });

  describe("pdf (RF-28)", () => {
    it("nomeia o arquivo com o período e a extensão certa", async () => {
      const { servico: s } = servico();
      const { arquivo } = await s.pdf("e1", "2026-09-10", "2026-09-16");
      expect(arquivo).toBe("rally-relatorio-2026-09-10-a-2026-09-16.pdf");
    });

    it("gera um PDF que um leitor reconhece", async () => {
      const { servico: s } = servico();
      const { conteudo } = await s.pdf("e1", "2026-09-10", "2026-09-10");

      expect(conteudo.subarray(0, 5).toString()).toBe("%PDF-");
      expect(conteudo.subarray(-6).toString().trim()).toBe("%%EOF");
    });

    it("leva o mesmo número que o CSV leva, sobre o mesmo dado", async () => {
      // O ponto da conferência: os três formatos saem da mesma chamada a
      // `relatorio()`. Um relatório que muda conforme o botão apertado é
      // pior do que relatório nenhum. A forma difere de propósito — o CSV
      // vai cru porque quem lê é o Excel; o PDF vai formatado para o olho.
      const { servico: s } = servico({
        reservas: [reserva({ preco: 1234.5, metodo: PagamentoMetodo.PIX })],
      });

      const { conteudo: csv } = await s.csv("e1", "2026-09-10", "2026-09-10");
      const { conteudo: pdf } = await s.pdf("e1", "2026-09-10", "2026-09-10");
      const texto = textoDoPdf(pdf);

      expect(csv).toContain("Receita recebida;1234,50");
      expect(texto).toContain("R$ 1.234,50");

      expect(csv).toContain("Pix;1;1234,50;100,0");
      expect(texto).toContain("Pix");
      expect(texto).toContain("100,0%");
    });

    it("ocupação sem denominador vira travessão, como na tela", async () => {
      // No CSV a mesma ausência vira célula vazia: lá o destinatário é o
      // Excel, aqui é uma pessoa, e para ela o travessão diz o que o branco
      // não diz.
      const { servico: s } = servico({
        estabelecimento: {
          nome: "Arena",
          timezone: "America/Sao_Paulo",
          horarios: [],
        },
        reservas: [reserva()],
      });
      const { conteudo } = await s.pdf("e1", "2026-09-10", "2026-09-10");

      expect(textoDoPdf(conteudo)).toContain("sem horário cadastrado");
    });

    it("recusa período inválido antes de montar o documento", async () => {
      const { servico: s } = servico();
      await expect(s.pdf("e1", "2026-09-20", "2026-09-10")).rejects.toThrow(BadRequestException);
    });
  });

  it("escopa toda a leitura pelo estabelecimento da rota", async () => {
    const { servico: s, prisma } = servico();
    await s.relatorio("e1", "2026-09-10", "2026-09-10");

    // ADR-0011: o relatório de um tenant não pode somar a receita de outro.
    expect((prisma.reserva.findMany as jest.Mock).mock.calls[0][0].where.estabelecimentoId).toBe(
      "e1",
    );
    expect((prisma.quadra.findMany as jest.Mock).mock.calls[0][0].where.estabelecimentoId).toBe(
      "e1",
    );
  });
});
