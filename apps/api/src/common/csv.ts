// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Geração de CSV para o Excel **brasileiro** (RF-28).
 *
 * Três detalhes decidem se o arquivo abre certo ou vira uma coluna só de
 * caracteres quebrados, e nenhum deles é opcional:
 *
 * 1. **Separador `;`.** O Excel usa como delimitador o separador de lista do
 *    sistema, que em pt-BR é ponto e vírgula. Com `,` a planilha inteira
 *    cai numa única coluna.
 * 2. **BOM UTF-8.** Sem ele o Excel assume a página de código do Windows e
 *    "Futevôlei" chega como "FutevÃ´lei".
 * 3. **Vírgula decimal.** `1234.5` aparece como texto num Excel pt-BR, não
 *    como número — e aí não soma.
 *
 * A consequência de (1) e (3) juntas é que **todo número precisa de aspas
 * ou de separador diferente da vírgula decimal**; aqui o separador é `;`,
 * então `1234,50` passa sem aspas.
 */

const SEPARADOR = ";";

/** Marca de ordem de bytes — faz o Excel ler o arquivo como UTF-8. */
export const BOM = "﻿";

/**
 * Escapa um campo. Aspas duplas viram duas; campo com separador, aspas ou
 * quebra de linha vai entre aspas.
 *
 * Sem isso, um nome de quadra com ponto e vírgula parte a linha em duas
 * colunas e desloca tudo à direita — erro que só aparece no dado real.
 */
function campo(valor: string): string {
  if (!/[";\r\n]/.test(valor)) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

/** Número no formato que o Excel pt-BR soma: vírgula decimal, sem milhar. */
export function numeroBr(valor: number, casas = 2): string {
  return valor.toFixed(casas).replace(".", ",");
}

/** Percentual, ou vazio quando não há o que medir — e não "0". */
export function percentualBr(valor: number | null): string {
  return valor === null ? "" : numeroBr(valor, 1);
}

/**
 * Monta o CSV a partir do cabeçalho e das linhas.
 *
 * Linha é `string[]` de propósito: a formatação de número e data é decisão
 * de quem chama, porque só ele sabe se aquela coluna é dinheiro, hora ou
 * contagem.
 */
export function montarCsv(cabecalho: string[], linhas: string[][]): string {
  const corpo = [cabecalho, ...linhas]
    .map((linha) => linha.map(campo).join(SEPARADOR))
    // CRLF porque é o que o Excel espera; com LF puro algumas versões
    // antigas juntam todas as linhas.
    .join("\r\n");
  return `${BOM}${corpo}\r\n`;
}
