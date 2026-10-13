// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Medida de tempo de resposta por rota (RNF-01).
 *
 * O RNF-01 é **Must** e pede p95 abaixo de 300 ms, com a busca de
 * disponibilidade abaixo de 500 ms. Até aqui ele era afirmado e nunca
 * medido: o relatório declarava isso como limitação, e requisito obrigatório
 * sem verificação é o pior tipo de lacuna numa defesa.
 *
 * ## O que esta medida é, e o que não é
 *
 * É o tempo que a **API** levou para responder, medido dentro do processo.
 * Não inclui rede, TLS nem o tempo do navegador — que é o que o RNF-02 mede,
 * e com outra ferramenta.
 *
 * A amostra é **limitada às últimas {@link AMOSTRAS} medidas por rota**, e
 * não ao histórico inteiro. Guardar tudo faria a memória crescer sem teto
 * num processo que roda por semanas; e, mais importante, um p95 sobre três
 * meses esconderia a piora de hoje debaixo da média de ontem. A janela móvel
 * responde "como está agora", que é a pergunta que o requisito faz.
 *
 * Vive **na memória do processo**: zera no reinício e não soma entre
 * instâncias. Para uma instância só, que é como o sistema roda hoje, isso
 * basta e é honesto; com várias, o lugar da medida passa a ser o coletor de
 * métricas, não o processo.
 */

/** Quantas medidas por rota a janela guarda. */
export const AMOSTRAS = 500;

export interface ResumoDaRota {
  rota: string;
  /** Quantas respostas entraram na conta desde o início do processo. */
  chamadas: number;
  /** Medidas na janela — é sobre elas que os percentis são calculados. */
  amostras: number;
  p50: number;
  p95: number;
  max: number;
}

/**
 * Percentil por ordenação, com o método do **vizinho mais próximo**.
 *
 * Sem interpolação de propósito: o número devolvido é um tempo que
 * aconteceu de verdade, e não a média de dois que aconteceram. Num relatório
 * que vai para uma banca, poder apontar a requisição é melhor do que a
 * precisão decimal que a interpolação acrescenta.
 */
export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicao = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.min(Math.max(posicao, 0), ordenados.length - 1)];
}

/** Janela móvel de medidas, por rota. */
export class Latencia {
  private readonly janelas = new Map<string, number[]>();
  private readonly totais = new Map<string, number>();

  /** Registra uma resposta. `ms` em milissegundos. */
  registrar(rota: string, ms: number): void {
    this.totais.set(rota, (this.totais.get(rota) ?? 0) + 1);

    const janela = this.janelas.get(rota) ?? [];
    janela.push(ms);
    // Descarta a mais antiga quando a janela enche: memória limitada por
    // rota, e o resumo acompanha o comportamento recente.
    if (janela.length > AMOSTRAS) janela.shift();
    this.janelas.set(rota, janela);
  }

  /** Resumo por rota, da mais lenta para a mais rápida no p95. */
  resumo(): ResumoDaRota[] {
    return [...this.janelas.entries()]
      .map(([rota, janela]) => ({
        rota,
        chamadas: this.totais.get(rota) ?? janela.length,
        amostras: janela.length,
        p50: percentil(janela, 50),
        p95: percentil(janela, 95),
        max: Math.max(...janela),
      }))
      .sort((a, b) => b.p95 - a.p95);
  }
}
