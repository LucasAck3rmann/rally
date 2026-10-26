// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PagamentoMetodo, PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

import ExcelJS from "exceljs";

import { montarCsv, numeroBr, percentualBr } from "../../common/csv";
import { emMinutos, horaLocalParaUtc } from "../../common/timezone";
import { PrismaService } from "../../prisma/prisma.service";
import { somaDias } from "./painel.service";
import { montarPdf } from "./relatorio-pdf";

/** Reservas que representam venda — bloqueio e cancelada ficam de fora. */
const VENDIDAS: ReservaStatus[] = [
  ReservaStatus.PENDENTE_PAGAMENTO,
  ReservaStatus.CONFIRMADA,
  ReservaStatus.CONCLUIDA,
  ReservaStatus.NO_SHOW,
];

const PARA_O_RELATORIO = {
  inicio: true,
  fim: true,
  status: true,
  preco: true,
  quadraId: true,
  quadra: { select: { nome: true } },
  pagamento: { select: { status: true, metodo: true } },
} satisfies Prisma.ReservaSelect;

type ReservaDoRelatorio = Prisma.ReservaGetPayload<{
  select: typeof PARA_O_RELATORIO;
}>;

/**
 * Relatórios de receita, ocupação, ticket médio e métodos (RF-27) e a
 * exportação em CSV (RF-28).
 *
 * O painel responde "como está indo"; o relatório responde "o que
 * aconteceu, dia por dia". Por isso aqui o período é **escolhido** e não
 * uma janela fixa, e a série diária existe — é ela que mostra que a
 * quarta-feira morreu, o que um total do mês esconde.
 */
@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async relatorio(estabelecimentoId: string, de: string, ate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
      throw new BadRequestException("Datas inválidas: use YYYY-MM-DD.");
    }
    if (de > ate) {
      throw new BadRequestException("A data inicial é depois da final.");
    }
    const dias = diasEntre(de, ate);
    if (dias > 366) {
      throw new BadRequestException("O período máximo é de um ano.");
    }

    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: estabelecimentoId },
      select: {
        nome: true,
        timezone: true,
        horarios: { select: { diaSemana: true, abre: true, fecha: true } },
      },
    });
    if (!estabelecimento) {
      throw new NotFoundException("Estabelecimento não encontrado.");
    }
    const { nome, timezone, horarios } = estabelecimento;

    const [quadras, reservas] = await Promise.all([
      this.prisma.quadra.findMany({
        where: { estabelecimentoId, ativo: true },
        // As modalidades entram aqui para o agrupamento por esporte (RF-28).
        // A pergunta veio do campo livre do Instrumento I, escrita por um
        // gestor: *"qual esporte que mais tem procura"*. O relatório sabia
        // responder por quadra e por dia, e não por modalidade.
        select: {
          id: true,
          nome: true,
          modalidades: { select: { nome: true }, orderBy: { nome: "asc" } },
        },
        orderBy: { nome: "asc" },
      }),
      this.prisma.reserva.findMany({
        where: {
          estabelecimentoId,
          inicio: {
            gte: horaLocalParaUtc(de, "00:00", timezone),
            lt: horaLocalParaUtc(somaDias(ate, 1), "00:00", timezone),
          },
        },
        select: PARA_O_RELATORIO,
        orderBy: { inicio: "asc" },
      }),
    ]);

    const vendidas = reservas.filter((r) => VENDIDAS.includes(r.status));
    const canceladas = reservas.filter((r) => r.status === ReservaStatus.CANCELADA);

    return {
      estabelecimento: { nome, timezone },
      periodo: { de, ate, dias },
      resumo: this.resumo(vendidas, canceladas, horarios, de, dias, quadras.length),
      porMetodo: this.porMetodo(vendidas),
      porDia: this.porDia(vendidas, horarios, de, dias, quadras.length, timezone),
      porQuadra: this.porQuadra(quadras, vendidas),
      porModalidade: this.porModalidade(quadras, vendidas),
    };
  }

  /** O mesmo relatório, pronto para abrir no Excel (RF-28). */
  async csv(estabelecimentoId: string, de: string, ate: string) {
    const r = await this.relatorio(estabelecimentoId, de, ate);

    const linhas: string[][] = [
      // Um bloco por seção, separados por linha vazia: é o formato que um
      // dono abre no Excel e entende sem legenda.
      ["Relatório Rally", r.estabelecimento.nome],
      ["Período", `${r.periodo.de} a ${r.periodo.ate}`],
      [],
      ["Resumo"],
      ["Receita recebida", numeroBr(r.resumo.receitaPaga)],
      ["Receita a receber", numeroBr(r.resumo.receitaAReceber)],
      ["Receita total", numeroBr(r.resumo.receitaTotal)],
      ["Ticket médio", r.resumo.ticketMedio === null ? "" : numeroBr(r.resumo.ticketMedio)],
      ["Ocupação (%)", percentualBr(r.resumo.ocupacao)],
      ["Reservas vendidas", String(r.resumo.vendidas)],
      ["Reservas canceladas", String(r.resumo.canceladas)],
      [],
      ["Método", "Reservas", "Valor", "Participação (%)"],
      ...r.porMetodo.map((m) => [
        m.metodo,
        String(m.reservas),
        numeroBr(m.valor),
        percentualBr(m.participacao),
      ]),
      [],
      ["Data", "Reservas", "Receita", "Ocupação (%)"],
      ...r.porDia.map((d) => [
        d.data,
        String(d.reservas),
        numeroBr(d.receita),
        percentualBr(d.ocupacao),
      ]),
      [],
      ["Quadra", "Reservas", "Horas", "Receita"],
      ...r.porQuadra.map((q) => [
        q.nome,
        String(q.reservas),
        numeroBr(q.horas, 1),
        numeroBr(q.receita),
      ]),
      [],
      // O aviso vai **dentro** da exportação, e não só na tela: quem abre o
      // arquivo no Excel não vê a nota da interface, e somaria a coluna.
      ["Modalidade", "Reservas", "Horas", "Receita", "Quadras"],
      ...r.porModalidade.map((m) => [
        m.modalidade,
        String(m.reservas),
        numeroBr(m.horas, 1),
        numeroBr(m.receita),
        String(m.quadras),
      ]),
      ["Uma quadra pode atender mais de uma modalidade; os valores acima nao somam o total."],
    ];

    return {
      // O nome do arquivo carrega o período: três relatórios na pasta de
      // downloads com o mesmo nome não se distinguem.
      arquivo: `rally-relatorio-${de}-a-${ate}.csv`,
      conteudo: montarCsv(["Rally", "", "", ""], linhas),
    };
  }

  /**
   * O mesmo relatório como planilha de verdade (RF-28).
   *
   * A diferença que justifica existir ao lado do CSV: aqui os números são
   * **números**, não texto. No CSV eles dependem de o Excel adivinhar a
   * localidade; no XLSX a célula já é numérica, soma e entra em gráfico sem
   * ninguém converter nada. Datas também: `Date` e não string.
   */
  async xlsx(estabelecimentoId: string, de: string, ate: string) {
    const r = await this.relatorio(estabelecimentoId, de, ate);
    const livro = new ExcelJS.Workbook();
    livro.creator = "Rally";
    livro.created = new Date();

    const resumo = livro.addWorksheet("Resumo");
    resumo.columns = [
      { header: "Indicador", key: "k", width: 26 },
      { header: "Valor", key: "v", width: 16 },
    ];
    resumo.addRows([
      { k: "Arena", v: r.estabelecimento.nome },
      { k: "Período", v: `${r.periodo.de} a ${r.periodo.ate}` },
      { k: "Receita recebida", v: r.resumo.receitaPaga },
      { k: "Receita a receber", v: r.resumo.receitaAReceber },
      { k: "Receita total", v: r.resumo.receitaTotal },
      { k: "Ticket médio", v: r.resumo.ticketMedio },
      { k: "Ocupação (%)", v: r.resumo.ocupacao },
      { k: "Horas vendidas", v: r.resumo.horasVendidas },
      { k: "Horas disponíveis", v: r.resumo.horasDisponiveis },
      { k: "Reservas vendidas", v: r.resumo.vendidas },
      { k: "Reservas canceladas", v: r.resumo.canceladas },
    ]);
    // Dinheiro com duas casas e separador de milhar: a formatação vive na
    // célula, não no valor — é o que permite somar e exibir ao mesmo tempo.
    for (const linha of [3, 4, 5, 6]) {
      resumo.getCell(`B${linha + 1}`).numFmt = "#,##0.00";
    }

    const metodos = livro.addWorksheet("Por método");
    metodos.columns = [
      { header: "Método", key: "metodo", width: 16 },
      { header: "Reservas", key: "reservas", width: 12 },
      { header: "Valor", key: "valor", width: 14, style: { numFmt: "#,##0.00" } },
      { header: "Participação (%)", key: "pct", width: 18 },
    ];
    for (const m of r.porMetodo) {
      metodos.addRow({
        metodo: m.metodo,
        reservas: m.reservas,
        valor: m.valor,
        pct: m.participacao,
      });
    }

    const dias = livro.addWorksheet("Dia por dia");
    dias.columns = [
      // `Date` e não string: só assim a planilha ordena e agrupa por data.
      { header: "Data", key: "data", width: 14, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Reservas", key: "reservas", width: 12 },
      { header: "Receita", key: "receita", width: 14, style: { numFmt: "#,##0.00" } },
      { header: "Horas", key: "horas", width: 10 },
      { header: "Ocupação (%)", key: "ocupacao", width: 16 },
    ];
    for (const d of r.porDia) {
      const [ano, mes, dia] = d.data.split("-").map(Number);
      dias.addRow({
        data: new Date(Date.UTC(ano, mes - 1, dia)),
        reservas: d.reservas,
        receita: d.receita,
        horas: d.horas,
        ocupacao: d.ocupacao,
      });
    }

    const quadras = livro.addWorksheet("Por quadra");
    quadras.columns = [
      { header: "Quadra", key: "nome", width: 24 },
      { header: "Reservas", key: "reservas", width: 12 },
      { header: "Horas", key: "horas", width: 10 },
      { header: "Receita", key: "receita", width: 14, style: { numFmt: "#,##0.00" } },
    ];
    for (const q of r.porQuadra) {
      quadras.addRow({
        nome: q.nome,
        reservas: q.reservas,
        horas: q.horas,
        receita: q.receita,
      });
    }

    const modalidades = livro.addWorksheet("Por modalidade");
    modalidades.columns = [
      { header: "Modalidade", key: "modalidade", width: 24 },
      { header: "Reservas", key: "reservas", width: 12 },
      { header: "Horas", key: "horas", width: 10 },
      { header: "Receita", key: "receita", width: 14, style: { numFmt: "#,##0.00" } },
      { header: "Quadras", key: "quadras", width: 10 },
    ];
    for (const m of r.porModalidade) {
      modalidades.addRow({
        modalidade: m.modalidade,
        reservas: m.reservas,
        horas: m.horas,
        receita: m.receita,
        quadras: m.quadras,
      });
    }
    // A ressalva vai na própria aba: quem recebe a planilha por e-mail não
    // recebe a tela junto, e somaria a coluna de receita sem pensar.
    modalidades.addRow({});
    modalidades.addRow({
      modalidade:
        "Uma quadra pode atender mais de uma modalidade; os valores acima não somam o total.",
    });

    for (const aba of livro.worksheets) {
      aba.getRow(1).font = { bold: true };
      // Congela o cabeçalho: numa série de 90 dias, rolar perde o nome da
      // coluna e a planilha deixa de se explicar.
      aba.views = [{ state: "frozen", ySplit: 1 }];
    }

    return {
      arquivo: `rally-relatorio-${de}-a-${ate}.xlsx`,
      conteudo: Buffer.from(await livro.xlsx.writeBuffer()),
    };
  }

  /**
   * O mesmo relatório como documento de leitura (RF-28).
   *
   * O que justifica existir ao lado dos outros dois: este é o formato que
   * se imprime e se anexa num e-mail. O desenho da página vive em
   * `relatorio-pdf.ts`, que não conhece banco nem Prisma — é o que permite
   * testar o documento sem subir nada.
   */
  async pdf(estabelecimentoId: string, de: string, ate: string) {
    const r = await this.relatorio(estabelecimentoId, de, ate);

    return {
      arquivo: `rally-relatorio-${de}-a-${ate}.pdf`,
      conteudo: await montarPdf(r),
    };
  }

  private resumo(
    vendidas: ReservaDoRelatorio[],
    canceladas: ReservaDoRelatorio[],
    horarios: Horario[],
    de: string,
    dias: number,
    quadras: number,
  ) {
    let paga = 0;
    let aReceber = 0;
    for (const r of vendidas) {
      const valor = Number(r.preco);
      if (r.pagamento?.status === PagamentoStatus.PAGO) paga += valor;
      else aReceber += valor;
    }
    const capacidade = horasAbertas(horarios, de, dias) * quadras;
    const horas = somaHoras(vendidas);

    return {
      receitaPaga: arredondar(paga),
      receitaAReceber: arredondar(aReceber),
      receitaTotal: arredondar(paga + aReceber),
      ticketMedio: vendidas.length === 0 ? null : arredondar((paga + aReceber) / vendidas.length),
      ocupacao: capacidade === 0 ? null : arredondar((horas / capacidade) * 100, 1),
      horasVendidas: arredondar(horas, 1),
      horasDisponiveis: arredondar(capacidade, 1),
      vendidas: vendidas.length,
      canceladas: canceladas.length,
    };
  }

  /**
   * Receita por método de pagamento (RF-27).
   *
   * Reserva **sem** pagamento entra como "Balcão": é venda de verdade, feita
   * na arena, e deixá-la fora faria a soma dos métodos não fechar com a
   * receita total — um relatório que não fecha não se usa.
   */
  private porMetodo(vendidas: ReservaDoRelatorio[]) {
    const total = vendidas.reduce((s, r) => s + Number(r.preco), 0);
    const porChave = new Map<string, { reservas: number; valor: number }>();

    for (const r of vendidas) {
      const chave = r.pagamento?.metodo ?? "BALCAO";
      const atual = porChave.get(chave) ?? { reservas: 0, valor: 0 };
      atual.reservas += 1;
      atual.valor += Number(r.preco);
      porChave.set(chave, atual);
    }

    const rotulos: Record<string, string> = {
      [PagamentoMetodo.PIX]: "Pix",
      [PagamentoMetodo.CARTAO]: "Cartão",
      BALCAO: "Balcão",
    };

    return [...porChave.entries()]
      .map(([chave, dados]) => ({
        metodo: rotulos[chave] ?? chave,
        reservas: dados.reservas,
        valor: arredondar(dados.valor),
        participacao: total === 0 ? null : arredondar((dados.valor / total) * 100, 1),
      }))
      .sort((a, b) => b.valor - a.valor);
  }

  /**
   * Série diária.
   *
   * Dia **sem movimento aparece com zero**, e não fora da lista: um gráfico
   * que pula a quarta-feira vazia mente sobre a forma da semana, e é
   * justamente o dia morto que o dono precisa ver.
   */
  private porDia(
    vendidas: ReservaDoRelatorio[],
    horarios: Horario[],
    de: string,
    dias: number,
    quadras: number,
    timezone: string,
  ) {
    const porData = new Map<string, ReservaDoRelatorio[]>();
    for (const r of vendidas) {
      const data = diaLocal(r.inicio, timezone);
      porData.set(data, [...(porData.get(data) ?? []), r]);
    }

    const saida: {
      data: string;
      reservas: number;
      receita: number;
      horas: number;
      ocupacao: number | null;
    }[] = [];
    for (let i = 0; i < dias; i++) {
      const data = somaDias(de, i);
      const doDia = porData.get(data) ?? [];
      const capacidade = horasAbertas(horarios, data, 1) * quadras;
      const horas = somaHoras(doDia);
      saida.push({
        data,
        reservas: doDia.length,
        receita: arredondar(doDia.reduce((s, r) => s + Number(r.preco), 0)),
        horas: arredondar(horas, 1),
        ocupacao: capacidade === 0 ? null : arredondar((horas / capacidade) * 100, 1),
      });
    }
    return saida;
  }

  /**
   * Receita e horas por modalidade (RF-28).
   *
   * **Os valores não somam o total, e isso é da natureza do dado, não um
   * defeito.** Uma quadra pode atender beach tennis e futevôlei ao mesmo
   * tempo, e a reserva não registra qual esporte foi jogado — registra a
   * quadra. Atribuir a reserva a **cada** modalidade da quadra é a leitura
   * honesta: responde "quais esportes têm procura" sem inventar uma
   * desambiguação que o dado não tem. Dividir a receita entre as modalidades
   * daria números que somam bonito e que nenhum gestor poderia conferir.
   *
   * Quadra sem modalidade cadastrada entra em "Não informada", em vez de
   * sumir: receita que desaparece de um relatório é pior que receita numa
   * linha sem nome.
   */
  private porModalidade(
    quadras: { id: string; nome: string; modalidades: { nome: string }[] }[],
    vendidas: ReservaDoRelatorio[],
  ) {
    const acumulado = new Map<
      string,
      { reservas: number; horas: number; receita: number; quadras: Set<string> }
    >();

    for (const quadra of quadras) {
      const daQuadra = vendidas.filter((r) => r.quadraId === quadra.id);
      if (daQuadra.length === 0) continue;
      const nomes = quadra.modalidades.length
        ? quadra.modalidades.map((m) => m.nome)
        : ["Não informada"];
      for (const nome of nomes) {
        const atual = acumulado.get(nome) ?? {
          reservas: 0,
          horas: 0,
          receita: 0,
          quadras: new Set<string>(),
        };
        atual.reservas += daQuadra.length;
        atual.horas += somaHoras(daQuadra);
        atual.receita += daQuadra.reduce((s, r) => s + Number(r.preco), 0);
        atual.quadras.add(quadra.id);
        acumulado.set(nome, atual);
      }
    }

    return [...acumulado.entries()]
      .map(([modalidade, v]) => ({
        modalidade,
        reservas: v.reservas,
        horas: arredondar(v.horas, 1),
        receita: arredondar(v.receita),
        // Quantas quadras atendem a modalidade: é o que explica por que uma
        // modalidade pode ter mais receita sem ter mais procura por horário.
        quadras: v.quadras.size,
      }))
      .sort((a, b) => b.receita - a.receita || a.modalidade.localeCompare(b.modalidade));
  }

  private porQuadra(quadras: { id: string; nome: string }[], vendidas: ReservaDoRelatorio[]) {
    return quadras
      .map((q) => {
        const daQuadra = vendidas.filter((r) => r.quadraId === q.id);
        return {
          quadraId: q.id,
          nome: q.nome,
          reservas: daQuadra.length,
          horas: arredondar(somaHoras(daQuadra), 1),
          receita: arredondar(daQuadra.reduce((s, r) => s + Number(r.preco), 0)),
        };
      })
      .sort((a, b) => b.receita - a.receita);
  }
}

type Horario = { diaSemana: number; abre: string; fecha: string };

function arredondar(valor: number, casas = 2): number {
  return Number(valor.toFixed(casas));
}

function somaHoras(reservas: { inicio: Date; fim: Date }[]): number {
  return reservas.reduce((s, r) => s + (r.fim.getTime() - r.inicio.getTime()) / 3_600_000, 0);
}

/** Data-calendário de um instante, no fuso do estabelecimento. */
function diaLocal(quando: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(quando);
}

/** Dias de calendário entre duas datas, inclusive as duas pontas. */
export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  const inicio = Date.UTC(a1, m1 - 1, d1);
  const fim = Date.UTC(a2, m2 - 1, d2);
  return Math.round((fim - inicio) / 86_400_000) + 1;
}

/** Horas de porta aberta no período, somando o horário de cada dia. */
function horasAbertas(horarios: Horario[], de: string, dias: number): number {
  if (horarios.length === 0) return 0;
  const porDia = new Map(horarios.map((h) => [h.diaSemana, h]));

  let total = 0;
  for (let i = 0; i < dias; i++) {
    const data = somaDias(de, i);
    const [ano, mes, dia] = data.split("-").map(Number);
    const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    const h = porDia.get(semana);
    if (!h) continue;
    const minutos = emMinutos(h.fecha) - emMinutos(h.abre);
    if (minutos > 0) total += minutos / 60;
  }
  return total;
}
