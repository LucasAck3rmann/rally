// SPDX-License-Identifier: AGPL-3.0-or-later
import { paginasDoPdf, posicoesDoPdf, textoDoPdf } from "./ler-pdf.spec-helper";
import {
  dataBr,
  dinheiro,
  montarPdf,
  percentual,
  texto,
  type RelatorioParaPdf,
} from "./relatorio-pdf";

const BASE: RelatorioParaPdf = {
  estabelecimento: {
    nome: "Arena Beach Sapiranga",
    timezone: "America/Sao_Paulo",
  },
  periodo: { de: "2026-09-10", ate: "2026-09-12", dias: 3 },
  resumo: {
    receitaPaga: 800,
    receitaAReceber: 240,
    receitaTotal: 1040,
    ticketMedio: 130,
    ocupacao: 42.5,
    horasVendidas: 8,
    horasDisponiveis: 42,
    vendidas: 8,
    canceladas: 1,
  },
  porMetodo: [
    { metodo: "Pix", reservas: 6, valor: 800, participacao: 76.9 },
    { metodo: "Balcão", reservas: 2, valor: 240, participacao: 23.1 },
  ],
  porDia: [
    { data: "2026-09-10", reservas: 4, receita: 640, horas: 4, ocupacao: 28.6 },
    { data: "2026-09-11", reservas: 0, receita: 0, horas: 0, ocupacao: 0 },
    { data: "2026-09-12", reservas: 4, receita: 400, horas: 4, ocupacao: 28.6 },
  ],
  porQuadra: [
    { quadraId: "q1", nome: "Quadra 1", reservas: 6, horas: 6, receita: 640 },
  ],
};

const QUANDO = new Date("2026-10-08T18:30:00.000Z");

function com(parcial: Partial<RelatorioParaPdf>): RelatorioParaPdf {
  return { ...BASE, ...parcial };
}

describe("formatação do relatório em PDF", () => {
  it("dinheiro sai com símbolo e separador de milhar", () => {
    // O PDF é para ler, não para calcular: aqui o número é formatado para o
    // olho. No CSV ele vai cru, porque lá quem lê é o Excel.
    expect(dinheiro(1234.5)).toBe("R$ 1.234,50");
    expect(dinheiro(0)).toBe("R$ 0,00");
  });

  it("sem denominador a ocupação é travessão, e não zero", () => {
    // "0%" afirma que a ocupação é zero; o travessão diz que não há o que
    // medir. São coisas diferentes e o relatório não pode confundi-las.
    expect(percentual(null)).toBe("—");
    expect(percentual(0)).toBe("0,0%");
    expect(percentual(42.46)).toBe("42,5%");
    // `toFixed` e não arredondamento próprio: 42,55 não é exatamente
    // representável em binário e sai "42,5". O CSV usa o mesmo `toFixed`, e
    // é por isso que os dois formatos não podem divergir na casa decimal.
    expect(percentual(42.55)).toBe("42,5%");
  });

  it("data vai em formato brasileiro", () => {
    expect(dataBr("2026-09-10")).toBe("10/09/2026");
  });

  it("o que a fonte padrão não representa vira '?' em vez de quebrar", () => {
    // Nome de arena é dado do usuário. Sem isto, uma quadra batizada com
    // emoji derruba a exportação inteira.
    expect(texto("Quadra 🏐 Central")).toBe("Quadra ? Central");
    expect(texto("Ação, coração, ênfase")).toBe("Ação, coração, ênfase");
    expect(texto("R$ 1.000,00")).toBe("R$ 1.000,00");
  });
});

describe("documento do relatório (RF-28)", () => {
  it("é um PDF válido e íntegro", async () => {
    const pdf = await montarPdf(BASE, QUANDO);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString().trim()).toBe("%%EOF");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("leva o mesmo número que o CSV e o XLSX levam", async () => {
    // Um relatório que diverge conforme o botão apertado é pior do que
    // relatório nenhum. Estes são os valores do resumo e das três quebras.
    const t = textoDoPdf(await montarPdf(BASE, QUANDO));

    expect(t).toContain("Arena Beach Sapiranga");
    expect(t).toContain("10/09/2026 a 12/09/2026");
    expect(t).toContain("R$ 800,00"); // recebido
    expect(t).toContain("R$ 240,00"); // a receber
    expect(t).toContain("R$ 1.040,00"); // total
    expect(t).toContain("R$ 130,00"); // ticket médio
    expect(t).toContain("42,5%"); // ocupação
    expect(t).toContain("Pix");
    expect(t).toContain("76,9%");
    expect(t).toContain("Balcão");
    expect(t).toContain("Quadra 1");
  });

  it("o dia sem movimento aparece na série, zerado", async () => {
    // Pular a quarta vazia mentiria sobre a forma da semana.
    const t = textoDoPdf(await montarPdf(BASE, QUANDO));
    expect(t).toContain("11/09/2026");
  });

  it("sem denominador, escreve o travessão e explica o vazio", async () => {
    const t = textoDoPdf(
      await montarPdf(
        com({ resumo: { ...BASE.resumo, ocupacao: null, horasDisponiveis: 0 } }),
        QUANDO,
      ),
    );

    expect(t).toContain("sem horário cadastrado");
    expect(t).toContain("—");
  });

  it("carimba a geração no fuso do estabelecimento", async () => {
    // 18:30 UTC são 15:30 em São Paulo. O dono lê a hora da arena dele.
    const t = textoDoPdf(await montarPdf(BASE, QUANDO));
    expect(t).toContain("08/10/2026 às 15:30");
  });

  it("numera as folhas e repete o cabeçalho da tabela", async () => {
    // Noventa dias não cabem numa folha; sem cabeçalho repetido, a folha
    // dois vira uma lista de números sem nome de coluna.
    const noventa = Array.from({ length: 90 }, (_, i) => ({
      data: `2026-07-${String((i % 30) + 1).padStart(2, "0")}`,
      reservas: i % 5,
      receita: i * 10,
      horas: i % 4,
      ocupacao: i % 100,
    }));
    const pdf = await montarPdf(
      com({
        porDia: noventa,
        periodo: { de: "2026-07-01", ate: "2026-09-28", dias: 90 },
      }),
      QUANDO,
    );
    const t = textoDoPdf(pdf);
    const folhas = paginasDoPdf(pdf);

    expect(folhas).toBeGreaterThan(1);
    expect(t).toContain(`1 de ${folhas}`);
    expect(t).toContain(`${folhas} de ${folhas}`);
    // "OCUPAÇÃO" é título de coluna: aparece uma vez por folha de tabela.
    expect((t.match(/OCUPAÇÃO/g) ?? []).length).toBeGreaterThan(1);
  });

  it("os títulos de coluna ficam todos na mesma linha", async () => {
    // Regressão de layout: `doc.text` avança o cursor vertical, e ler o
    // cursor dentro do laço fazia cada título sair mais abaixo que o
    // anterior — o cabeçalho descia em escada pela folha. O texto extraído
    // era idêntico ao do cabeçalho certo, então só a posição denuncia.
    const postos = posicoesDoPdf(await montarPdf(BASE, QUANDO));

    // Ancorado em "MÉTODO", que só existe num cabeçalho: "RESERVAS" é
    // rótulo de cartão e título de três tabelas, e procurá-lo solto pegaria
    // a ocorrência errada.
    const linha = postos.find((p) => p.texto === "MÉTODO");
    expect(linha).toBeDefined();

    const xs = [linha!.x];
    for (const t of ["RESERVAS", "VALOR", "PARTICIPAÇÃO"]) {
      const naMesmaLinha = postos.filter((p) => p.texto === t && p.y === linha!.y);
      expect(naMesmaLinha).toHaveLength(1);
      xs.push(naMesmaLinha[0].x);
    }

    // E crescem da esquerda para a direita, cada um na sua coluna.
    expect([...xs]).toEqual([...xs].sort((a, b) => a - b));
  });

  it("período sem venda nenhuma gera documento, e diz que está vazio", async () => {
    // O dono que teve um mês parado também pede relatório; devolver erro
    // ou página em branco faria parecer defeito.
    const t = textoDoPdf(
      await montarPdf(com({ porMetodo: [], porQuadra: [], porDia: [] }), QUANDO),
    );

    expect(t).toContain("Nenhuma venda no período.");
    expect(t).toContain("Nenhuma quadra ativa.");
  });

  it("nome com caractere fora da fonte não derruba a exportação", async () => {
    const pdf = await montarPdf(
      com({
        estabelecimento: {
          nome: "Arena 🏐 Beach",
          timezone: "America/Sao_Paulo",
        },
        porQuadra: [
          {
            quadraId: "q1",
            nome: "Quadra 日本",
            reservas: 1,
            horas: 1,
            receita: 80,
          },
        ],
      }),
      QUANDO,
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(textoDoPdf(pdf)).toContain("Arena ? Beach");
  });

  it("o mesmo relatório no mesmo instante gera o mesmo documento", async () => {
    // Sem isto, nada garante que o conteúdo não dependa de estado solto.
    const a = textoDoPdf(await montarPdf(BASE, QUANDO));
    const b = textoDoPdf(await montarPdf(BASE, QUANDO));
    expect(a).toBe(b);
  });
});
