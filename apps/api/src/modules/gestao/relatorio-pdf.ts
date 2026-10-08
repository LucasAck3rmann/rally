// SPDX-License-Identifier: AGPL-3.0-or-later
import PDFDocument from "pdfkit";

/**
 * O relatório como documento de leitura (RF-28).
 *
 * Os três formatos da exportação não são o mesmo arquivo em embalagens
 * diferentes, e a diferença é a razão de os três existirem:
 *
 * * **CSV** — para importar em outro sistema.
 * * **XLSX** — para calcular: número é número e data é data, soma e entra
 *   em gráfico sem ninguém converter nada.
 * * **PDF** — para **ler e enviar**: imprimir, anexar num e-mail, mostrar
 *   ao contador ou ao sócio. Aqui o número é formatado para o olho, com
 *   separador de milhar e símbolo de moeda, e a página tem rodapé e
 *   numeração — coisas que atrapalhariam nos outros dois.
 *
 * Os números são os mesmos dos outros dois formatos, e há teste que o
 * garante: um relatório que diverge conforme o botão apertado é pior do que
 * relatório nenhum.
 */

/** O que o documento precisa saber. Declarado aqui, e não importado do
 *  serviço, para que o desenho da página possa ser testado sem banco. */
export interface RelatorioParaPdf {
  estabelecimento: { nome: string; timezone: string };
  periodo: { de: string; ate: string; dias: number };
  resumo: {
    receitaPaga: number;
    receitaAReceber: number;
    receitaTotal: number;
    ticketMedio: number | null;
    ocupacao: number | null;
    horasVendidas: number;
    horasDisponiveis: number;
    vendidas: number;
    canceladas: number;
  };
  porMetodo: {
    metodo: string;
    reservas: number;
    valor: number;
    participacao: number | null;
  }[];
  porDia: {
    data: string;
    reservas: number;
    receita: number;
    horas: number;
    ocupacao: number | null;
  }[];
  porQuadra: {
    quadraId: string;
    nome: string;
    reservas: number;
    horas: number;
    receita: number;
  }[];
}

const MARGEM = 40;
const TINTA = "#111111";
const APOIO = "#5C6671";
const LINHA = "#D7DBE0";
const FUNDO_CABECALHO = "#F1F3F5";

const dinheiroBr = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Faixa que as fontes padrão do PDF (WinAnsi) sabem representar.
 *
 * Nome de arena e de quadra são dados do usuário: podem trazer emoji ou
 * alfabeto não latino, e aí a fonte padrão ou falha ou desenha lixo. Trocar
 * por `?` degrada o nome, mas entrega o arquivo — e o relatório não é o
 * lugar de descobrir que alguém batizou a quadra com um emoji.
 */
// A flag `u` é o que faz um emoji — que em UTF-16 são duas unidades —
// contar como um caractere só, e virar um `?` em vez de dois.
const REPRESENTAVEL =
  /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu;

export function texto(valor: string): string {
  // O espaço fino que o `Intl` põe entre "R$" e o número vira espaço comum:
  // ele existe em WinAnsi, mas atrapalha a medida de largura da pdfkit.
  return valor.normalize("NFC").replace(/\u00a0/g, " ").replace(REPRESENTAVEL, "?");
}

export function dinheiro(valor: number): string {
  return texto(dinheiroBr.format(valor));
}

/** Percentual com uma casa, ou travessão — e não "0" — quando não há
 *  denominador. Zero diria "a ocupação é zero"; o travessão diz "não há o
 *  que medir". É a mesma regra do painel e da tela de relatórios. */
export function percentual(valor: number | null): string {
  return valor === null ? "—" : `${valor.toFixed(1).replace(".", ",")}%`;
}

export function dataBr(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function carimbo(quando: Date, timeZone: string): string {
  const d = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(quando);
  const h = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(quando);
  return texto(`${d} às ${h}`);
}

interface Coluna {
  titulo: string;
  largura: number;
  direita?: boolean;
}

type Doc = PDFKit.PDFDocument;

/** Onde o conteúdo pode terminar antes de a folha acabar. */
function pe(doc: Doc): number {
  return doc.page.height - doc.page.margins.bottom;
}

function largura(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function titulo(doc: Doc, texto_: string): void {
  // Um título sozinho no pé da folha é um título perdido: se não couber
  // com pelo menos duas linhas de tabela abaixo, começa na folha seguinte.
  if (doc.y + 56 > pe(doc)) doc.addPage();
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(TINTA)
    .text(texto(texto_), doc.page.margins.left, doc.y);
  doc.moveDown(0.4);
}

function cabecalhoDaTabela(doc: Doc, colunas: Coluna[]): void {
  const x0 = doc.page.margins.left;
  const altura = 18;
  // `doc.text` avança o `doc.y`. Sem guardar a linha de base antes do laço,
  // cada título de coluna sai mais abaixo que o anterior e o cabeçalho
  // desce em escada pela folha.
  const y = doc.y;

  doc.rect(x0, y, largura(doc), altura).fill(FUNDO_CABECALHO);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(APOIO);

  let x = x0;
  for (const c of colunas) {
    doc.text(texto(c.titulo).toUpperCase(), x + 5, y + 5.5, {
      width: c.largura - 10,
      align: c.direita ? "right" : "left",
      lineBreak: false,
      ellipsis: true,
    });
    x += c.largura;
  }
  doc.y = y + altura;
}

/**
 * Tabela com quebra de página e cabeçalho repetido.
 *
 * O cabeçalho se repete porque, numa série de noventa dias, a folha dois
 * sem cabeçalho é uma lista de números sem nome de coluna.
 */
function tabela(doc: Doc, colunas: Coluna[], linhas: string[][]): void {
  cabecalhoDaTabela(doc, colunas);
  doc.font("Helvetica").fontSize(9.5);

  for (const linha of linhas) {
    const alturas = linha.map((celula, i) =>
      doc.heightOfString(celula, { width: colunas[i].largura - 10 }),
    );
    const altura = Math.max(14, ...alturas) + 7;

    if (doc.y + altura > pe(doc)) {
      doc.addPage();
      cabecalhoDaTabela(doc, colunas);
      doc.font("Helvetica").fontSize(9.5);
    }

    const y = doc.y;
    let x = doc.page.margins.left;
    doc.fillColor(TINTA);
    for (const [i, c] of colunas.entries()) {
      doc.text(linha[i] ?? "", x + 5, y + 4, {
        width: c.largura - 10,
        align: c.direita ? "right" : "left",
        ellipsis: true,
      });
      x += c.largura;
    }
    doc.y = y + altura;

    doc
      .moveTo(doc.page.margins.left, doc.y - 0.5)
      .lineTo(doc.page.margins.left + largura(doc), doc.y - 0.5)
      .lineWidth(0.5)
      .strokeColor(LINHA)
      .stroke();
  }
  doc.moveDown(1);
}

/** Grade de indicadores: rótulo pequeno em cima, número grande embaixo. */
function indicadores(doc: Doc, itens: { rotulo: string; valor: string; apoio?: string }[]): void {
  const colunas = 3;
  const vao = 10;
  const w = (largura(doc) - vao * (colunas - 1)) / colunas;
  const alturaCartao = 52;

  for (let i = 0; i < itens.length; i += colunas) {
    const faixa = itens.slice(i, i + colunas);
    if (doc.y + alturaCartao > pe(doc)) doc.addPage();
    const y = doc.y;
    for (const [j, item] of faixa.entries()) {
      const x = doc.page.margins.left + j * (w + vao);
      doc.rect(x, y, w, alturaCartao).lineWidth(0.5).strokeColor(LINHA).stroke();
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(APOIO)
        .text(texto(item.rotulo).toUpperCase(), x + 9, y + 9, {
          width: w - 18,
          lineBreak: false,
          ellipsis: true,
        });
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(TINTA)
        .text(texto(item.valor), x + 9, y + 22, {
          width: w - 18,
          lineBreak: false,
          ellipsis: true,
        });
      if (item.apoio) {
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(APOIO)
          .text(texto(item.apoio), x + 9, y + 39, {
            width: w - 18,
            lineBreak: false,
            ellipsis: true,
          });
      }
    }
    doc.y = y + alturaCartao + vao;
  }
}

/** Rodapé em todas as folhas, com "x de y" — que só se sabe no fim. */
function rodape(doc: Doc, r: RelatorioParaPdf, gerado: string): void {
  const faixa = doc.bufferedPageRange();
  for (let i = 0; i < faixa.count; i++) {
    doc.switchToPage(faixa.start + i);
    // Escrever na área do rodapé acrescentaria uma folha se a margem
    // inferior continuasse valendo; zerá-la é o jeito de a pdfkit deixar.
    const guardada = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(APOIO)
      .text(
        texto(`Rally · ${r.estabelecimento.nome} · gerado em ${gerado}`),
        doc.page.margins.left,
        doc.page.height - 28,
        { width: largura(doc) - 70, lineBreak: false, ellipsis: true },
      )
      .text(
        `${i + 1} de ${faixa.count}`,
        doc.page.margins.left + largura(doc) - 70,
        doc.page.height - 28,
        { width: 70, align: "right", lineBreak: false },
      );
    doc.page.margins.bottom = guardada;
  }
}

/**
 * Monta o PDF e devolve o arquivo pronto.
 *
 * `geradoEm` é parâmetro e não `new Date()` lá dentro para que o teste possa
 * fixar o carimbo e comparar bytes.
 */
export function montarPdf(
  r: RelatorioParaPdf,
  geradoEm: Date = new Date(),
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: MARGEM, bottom: 46, left: MARGEM, right: MARGEM },
    bufferPages: true,
    info: {
      Title: `Relatório Rally — ${texto(r.estabelecimento.nome)}`,
      Author: "Rally",
      Subject: `${dataBr(r.periodo.de)} a ${dataBr(r.periodo.ate)}`,
    },
  });

  const pedacos: Buffer[] = [];
  const pronto = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (p: Buffer) => pedacos.push(p));
    doc.on("end", () => resolve(Buffer.concat(pedacos)));
    doc.on("error", reject);
  });

  const gerado = carimbo(geradoEm, r.estabelecimento.timezone);

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(TINTA)
    .text("Relatório", doc.page.margins.left, doc.page.margins.top);
  doc
    .font("Helvetica")
    .fontSize(11)
    .fillColor(TINTA)
    .text(texto(r.estabelecimento.nome));
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(APOIO)
    .text(
      texto(
        `${dataBr(r.periodo.de)} a ${dataBr(r.periodo.ate)} · ` +
          `${r.periodo.dias} dia${r.periodo.dias > 1 ? "s" : ""}`,
      ),
    );
  doc.moveDown(1.2);

  const { resumo } = r;
  indicadores(doc, [
    { rotulo: "Recebido", valor: dinheiro(resumo.receitaPaga) },
    { rotulo: "A receber", valor: dinheiro(resumo.receitaAReceber) },
    { rotulo: "Receita total", valor: dinheiro(resumo.receitaTotal) },
    {
      rotulo: "Ticket médio",
      valor: resumo.ticketMedio === null ? "—" : dinheiro(resumo.ticketMedio),
    },
    {
      rotulo: "Ocupação",
      valor: percentual(resumo.ocupacao),
      apoio:
        resumo.ocupacao === null
          ? "sem horário cadastrado"
          : `${resumo.horasVendidas.toFixed(1).replace(".", ",")}h de ` +
            `${resumo.horasDisponiveis.toFixed(1).replace(".", ",")}h`,
    },
    {
      rotulo: "Reservas",
      valor: String(resumo.vendidas),
      apoio: `${resumo.canceladas} cancelada${resumo.canceladas === 1 ? "" : "s"}`,
    },
  ]);
  doc.moveDown(0.6);

  const w = largura(doc);
  titulo(doc, "Por método de pagamento");
  if (r.porMetodo.length === 0) {
    doc.font("Helvetica").fontSize(9.5).fillColor(APOIO)
      .text("Nenhuma venda no período.");
    doc.moveDown(1);
  } else {
    tabela(
      doc,
      [
        { titulo: "Método", largura: w * 0.4 },
        { titulo: "Reservas", largura: w * 0.2, direita: true },
        { titulo: "Valor", largura: w * 0.2, direita: true },
        { titulo: "Participação", largura: w * 0.2, direita: true },
      ],
      r.porMetodo.map((m) => [
        texto(m.metodo),
        String(m.reservas),
        dinheiro(m.valor),
        percentual(m.participacao),
      ]),
    );
  }

  titulo(doc, "Por quadra");
  if (r.porQuadra.length === 0) {
    doc.font("Helvetica").fontSize(9.5).fillColor(APOIO)
      .text("Nenhuma quadra ativa.");
    doc.moveDown(1);
  } else {
    tabela(
      doc,
      [
        { titulo: "Quadra", largura: w * 0.4 },
        { titulo: "Reservas", largura: w * 0.2, direita: true },
        { titulo: "Horas", largura: w * 0.2, direita: true },
        { titulo: "Receita", largura: w * 0.2, direita: true },
      ],
      r.porQuadra.map((q) => [
        texto(q.nome),
        String(q.reservas),
        `${q.horas.toFixed(1).replace(".", ",")}h`,
        dinheiro(q.receita),
      ]),
    );
  }

  titulo(doc, "Dia por dia");
  // O dia sem movimento aparece zerado, de propósito: uma série que pula a
  // quarta morta mente sobre a forma da semana.
  tabela(
    doc,
    [
      { titulo: "Data", largura: w * 0.28 },
      { titulo: "Reservas", largura: w * 0.18, direita: true },
      { titulo: "Horas", largura: w * 0.18, direita: true },
      { titulo: "Receita", largura: w * 0.18, direita: true },
      { titulo: "Ocupação", largura: w * 0.18, direita: true },
    ],
    r.porDia.map((d) => [
      dataBr(d.data),
      String(d.reservas),
      `${d.horas.toFixed(1).replace(".", ",")}h`,
      dinheiro(d.receita),
      percentual(d.ocupacao),
    ]),
  );

  rodape(doc, r, gerado);
  doc.end();
  return pronto;
}
