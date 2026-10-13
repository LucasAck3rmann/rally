// SPDX-License-Identifier: AGPL-3.0-or-later
import { AMOSTRAS, Latencia, percentil } from "./latencia";

describe("percentil", () => {
  it("devolve um tempo que aconteceu de verdade", () => {
    // Vizinho mais próximo, sem interpolação: num relatório que vai para
    // uma banca, poder apontar a requisição vale mais do que a casa decimal
    // que a interpolação acrescentaria.
    const valores = [10, 20, 30, 40, 50];
    expect(valores).toContain(percentil(valores, 50));
    expect(valores).toContain(percentil(valores, 95));
  });

  it("o p95 de cem medidas é a nonagésima quinta em ordem", () => {
    const valores = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(valores, 95)).toBe(95);
    expect(percentil(valores, 50)).toBe(50);
  });

  it("não depende da ordem de chegada", () => {
    const crescente = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const embaralhado = [7, 2, 10, 1, 5, 9, 3, 8, 4, 6];
    expect(percentil(embaralhado, 95)).toBe(percentil(crescente, 95));
  });

  it("amostra vazia é zero, e não erro", () => {
    expect(percentil([], 95)).toBe(0);
  });

  it("uma medida só é ela mesma em qualquer percentil", () => {
    expect(percentil([42], 50)).toBe(42);
    expect(percentil([42], 95)).toBe(42);
  });
});

describe("Latencia", () => {
  let l: Latencia;
  beforeEach(() => {
    l = new Latencia();
  });

  it("separa as medidas por rota", () => {
    l.registrar("GET /quadras", 10);
    l.registrar("GET /quadras", 20);
    l.registrar("POST /reservas", 300);

    const porRota = Object.fromEntries(l.resumo().map((r) => [r.rota, r]));
    expect(porRota["GET /quadras"].amostras).toBe(2);
    expect(porRota["POST /reservas"].p95).toBe(300);
  });

  it("ordena da rota mais lenta para a mais rápida no p95", () => {
    // Quem abre o resumo quer achar o problema, não ler a lista inteira.
    l.registrar("GET /rapida", 5);
    l.registrar("POST /lenta", 900);
    l.registrar("GET /media", 100);

    expect(l.resumo().map((r) => r.rota)).toEqual([
      "POST /lenta",
      "GET /media",
      "GET /rapida",
    ]);
  });

  it("a janela guarda as últimas medidas, e descarta as antigas", () => {
    // Memória limitada por rota, e o resumo acompanha o comportamento
    // recente em vez de diluir a piora de hoje na média de ontem.
    for (let i = 0; i < AMOSTRAS + 50; i++) l.registrar("GET /x", i);

    const [r] = l.resumo();
    expect(r.amostras).toBe(AMOSTRAS);
    expect(r.chamadas).toBe(AMOSTRAS + 50);
  });

  it("o p95 esquece a lentidão que saiu da janela", () => {
    // É o ponto de ter janela móvel: uma rota que estava lenta e melhorou
    // precisa aparecer como rápida.
    l.registrar("GET /x", 5000);
    for (let i = 0; i < AMOSTRAS; i++) l.registrar("GET /x", 10);

    const [r] = l.resumo();
    expect(r.p95).toBe(10);
    expect(r.max).toBe(10);
    // Mas a contagem total não esquece: foram AMOSTRAS + 1 respostas.
    expect(r.chamadas).toBe(AMOSTRAS + 1);
  });

  it("conta as chamadas desde o início, não só as da janela", () => {
    for (let i = 0; i < 3; i++) l.registrar("GET /x", 1);
    expect(l.resumo()[0]).toMatchObject({ chamadas: 3, amostras: 3 });
  });

  it("sem medida nenhuma, o resumo é vazio", () => {
    expect(l.resumo()).toEqual([]);
  });
});
