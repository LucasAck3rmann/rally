// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  PagamentoMetodo,
  PagamentoStatus,
  Prisma,
  ReservaStatus,
} from "@prisma/client";

import { montarCsv, numeroBr, percentualBr } from "../../common/csv";
import { emMinutos, horaLocalParaUtc } from "../../common/timezone";
import { PrismaService } from "../../prisma/prisma.service";
import { somaDias } from "./painel.service";

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
        select: { id: true, nome: true },
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
    ];

    return {
      // O nome do arquivo carrega o período: três relatórios na pasta de
      // downloads com o mesmo nome não se distinguem.
      arquivo: `rally-relatorio-${de}-a-${ate}.csv`,
      conteudo: montarCsv(["Rally", "", "", ""], linhas),
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
      ticketMedio:
        vendidas.length === 0 ? null : arredondar((paga + aReceber) / vendidas.length),
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

  private porQuadra(
    quadras: { id: string; nome: string }[],
    vendidas: ReservaDoRelatorio[],
  ) {
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
  return reservas.reduce(
    (s, r) => s + (r.fim.getTime() - r.inicio.getTime()) / 3_600_000,
    0,
  );
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
