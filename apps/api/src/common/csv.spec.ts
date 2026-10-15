// SPDX-License-Identifier: AGPL-3.0-or-later
import { BOM, montarCsv, numeroBr, percentualBr } from "./csv";

describe("CSV para o Excel brasileiro", () => {
  it("começa com BOM, senão o Excel quebra os acentos", () => {
    // Sem BOM, "Futevôlei" chega como "FutevÃ´lei" num Excel pt-BR.
    const csv = montarCsv(["Quadra"], [["Futevôlei"]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain("Futevôlei");
  });

  it("separa por ponto e vírgula, não por vírgula", () => {
    // O Excel usa o separador de lista do sistema; em pt-BR é `;`. Com `,`
    // a planilha inteira cai numa coluna só.
    const csv = montarCsv(["A", "B"], [["1", "2"]]);
    expect(csv).toContain("A;B");
    expect(csv).toContain("1;2");
  });

  it("termina as linhas em CRLF", () => {
    const csv = montarCsv(["A"], [["1"]]);
    expect(csv).toBe(`${BOM}A\r\n1\r\n`);
  });

  it("protege o campo que contém o separador", () => {
    // Um nome de quadra com `;` partiria a linha em duas colunas e
    // deslocaria tudo à direita — erro que só aparece no dado real.
    const csv = montarCsv(["Nome"], [["Quadra 1; coberta"]]);
    expect(csv).toContain('"Quadra 1; coberta"');
  });

  it("dobra as aspas dentro do campo", () => {
    const csv = montarCsv(["Nome"], [['Quadra "A"']]);
    expect(csv).toContain('"Quadra ""A"""');
  });

  it("protege o campo com quebra de linha", () => {
    const csv = montarCsv(["Obs"], [["linha um\nlinha dois"]]);
    expect(csv).toContain('"linha um\nlinha dois"');
  });

  it("não põe aspas onde não precisa", () => {
    // Aspas em tudo funciona e deixa o arquivo ilegível fora do Excel.
    const csv = montarCsv(["Nome"], [["Quadra 1"]]);
    expect(csv).not.toContain('"');
  });

  describe("números", () => {
    it("usam vírgula decimal, que é o que o Excel pt-BR soma", () => {
      // Com ponto, "1234.50" entra como texto e não soma.
      expect(numeroBr(1234.5)).toBe("1234,50");
    });

    it("não levam separador de milhar", () => {
      // "1.234,50" com o separador `;` ainda confunde parte dos leitores;
      // o Excel formata o milhar na exibição, não no arquivo.
      expect(numeroBr(1234567.89)).toBe("1234567,89");
    });

    it("arredondam para as casas pedidas", () => {
      expect(numeroBr(42.456, 1)).toBe("42,5");
      expect(numeroBr(8, 0)).toBe("8");
    });

    it("percentual nulo vira vazio, não zero", () => {
      // "0" afirmaria que a ocupação foi zero; vazio diz que não há o que
      // medir — a mesma regra do painel.
      expect(percentualBr(null)).toBe("");
      expect(percentualBr(42.45)).toBe("42,5");
    });
  });
});
