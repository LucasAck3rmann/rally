// SPDX-License-Identifier: AGPL-3.0-or-later
import zlib from "node:zlib";

/**
 * Lê de volta o texto desenhado num PDF, sem biblioteca de leitura.
 *
 * Existe para os testes poderem afirmar que o número do relatório chegou ao
 * papel — e não apenas que o arquivo tem bytes. Fazer à mão evita uma
 * dependência inteira só para conferir texto: os fluxos de conteúdo da
 * pdfkit saem comprimidos, e inflá-los já entrega os operadores.
 *
 * Não é um leitor de PDF de uso geral: entende só o que a pdfkit escreve.
 */

const WINANSI_ALTO: Record<number, string> = {
  0x80: "€",
  0x85: "…",
  0x91: "‘",
  0x92: "’",
  0x93: "“",
  0x94: "”",
  0x95: "•",
  0x96: "–",
  0x97: "—",
  0x99: "™",
};

function deWinAnsi(bytes: number[]): string {
  return bytes
    .map((b) =>
      b >= 0x80 && b <= 0x9f ? (WINANSI_ALTO[b] ?? "?") : String.fromCharCode(b),
    )
    .join("");
}

/**
 * A pdfkit escreve o texto como string hexadecimal dentro de arrays `TJ`:
 * `[<4172656e61> 10 <204265616368>] TJ`. Os números no meio são ajuste de
 * espacejamento — os pedaços de hexa de um mesmo array formam uma palavra
 * só e precisam ser colados antes de decodificar.
 */
function hex(bruto: string): string {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < bruto.length; i += 2) {
    bytes.push(parseInt(bruto.slice(i, i + 2), 16));
  }
  return deWinAnsi(bytes);
}

function literais(conteudo: string): string[] {
  const saida: string[] = [];
  for (const grupo of conteudo.match(/\[[^\]]*\]\s*TJ/g) ?? []) {
    const pedacos = grupo.match(/<[0-9a-fA-F]*>/g) ?? [];
    saida.push(pedacos.map((p) => hex(p.slice(1, -1))).join(""));
  }
  for (const solto of conteudo.match(/<[0-9a-fA-F]*>\s*Tj/g) ?? []) {
    saida.push(hex(solto.replace(/[^0-9a-fA-F]/g, "")));
  }
  return saida;
}

export function textoDoPdf(pdf: Buffer): string {
  const bruto = pdf.toString("latin1");
  const saida: string[] = [];
  const marca = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = marca.exec(bruto)) !== null) {
    const inicio = m.index + m[0].length;
    const fim = bruto.indexOf("endstream", inicio);
    if (fim < 0) continue;
    const corpo = bruto.slice(inicio, fim).replace(/\r?\n$/, "");
    try {
      const inflado = zlib
        .inflateSync(Buffer.from(corpo, "latin1"))
        .toString("latin1");
      saida.push(...literais(inflado));
    } catch {
      // Fluxo que não é de conteúdo (fonte, imagem) — não interessa aqui.
    }
  }
  return saida.join("\u0001");
}

export function paginasDoPdf(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

export interface Desenhado {
  texto: string;
  x: number;
  y: number;
}

/**
 * O mesmo texto, com a posição em que foi desenhado.
 *
 * Existe porque conferir só o texto deixa passar defeito de layout: um
 * cabeçalho de tabela cujas colunas descem em escada pela folha tem
 * exatamente o mesmo texto de um cabeçalho alinhado.
 *
 * A pdfkit escreve `1 0 0 1 X Y Tm` antes de cada trecho; aqui cada string
 * fica com o último `Tm` visto.
 */
export function posicoesDoPdf(pdf: Buffer): Desenhado[] {
  const bruto = pdf.toString("latin1");
  const saida: Desenhado[] = [];
  const marca = /stream\r?\n/g;
  let m: RegExpExecArray | null;

  while ((m = marca.exec(bruto)) !== null) {
    const inicio = m.index + m[0].length;
    const fim = bruto.indexOf("endstream", inicio);
    if (fim < 0) continue;
    const corpo = bruto.slice(inicio, fim).replace(/\r?\n$/, "");

    let conteudo: string;
    try {
      conteudo = zlib.inflateSync(Buffer.from(corpo, "latin1")).toString("latin1");
    } catch {
      continue;
    }

    const passos =
      /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm|(\[[^\]]*\]\s*TJ)|(<[0-9a-fA-F]*>\s*Tj)/g;
    let x = 0;
    let y = 0;
    let p: RegExpExecArray | null;
    while ((p = passos.exec(conteudo)) !== null) {
      if (p[1] !== undefined) {
        x = Number(p[1]);
        y = Number(p[2]);
        continue;
      }
      const trecho = p[3] ?? p[4];
      const pedacos = trecho.match(/<[0-9a-fA-F]*>/g) ?? [];
      const t = pedacos.map((d) => hex(d.slice(1, -1))).join("");
      if (t.trim()) saida.push({ texto: t, x, y });
    }
  }
  return saida;
}
