// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

import {
  emMinutos,
  hojeLocal,
  horaLocalParaUtc,
  rotuloHoraLocal,
} from "../../common/timezone";
import { PrismaService } from "../../prisma/prisma.service";

/** Reservas que representam venda — bloqueio e cancelada ficam de fora. */
const VENDIDAS: ReservaStatus[] = [
  ReservaStatus.PENDENTE_PAGAMENTO,
  ReservaStatus.CONFIRMADA,
  ReservaStatus.CONCLUIDA,
  ReservaStatus.NO_SHOW,
];

const PARA_O_PAINEL = {
  id: true,
  inicio: true,
  fim: true,
  status: true,
  preco: true,
  quadraId: true,
  quadra: { select: { nome: true } },
  cliente: { select: { nome: true } },
  pagamento: { select: { status: true, valor: true } },
} satisfies Prisma.ReservaSelect;

type ReservaDoPainel = Prisma.ReservaGetPayload<{
  select: typeof PARA_O_PAINEL;
}>;

/**
 * Painel do dono: ocupação, receita e próximos jogos (RF-22).
 *
 * Tudo é calculado sobre um **período fechado** de dias no fuso do
 * estabelecimento. Não há cache: o painel de uma arena tem dezenas de
 * reservas por semana, e um número errado por estar velho é pior que um
 * número que demora 200 ms.
 */
@Injectable()
export class PainelService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(estabelecimentoId: string, dias: number) {
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) {
      throw new BadRequestException("O período vai de 1 a 90 dias.");
    }

    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: estabelecimentoId },
      select: {
        timezone: true,
        horarios: { select: { diaSemana: true, abre: true, fecha: true } },
      },
    });
    if (!estabelecimento) {
      throw new NotFoundException("Estabelecimento não encontrado.");
    }

    const { timezone, horarios } = estabelecimento;
    // O período termina **hoje**, inclusive: o dono quer saber como foi a
    // semana até agora, não até ontem.
    const ate = hojeLocal(timezone);
    const de = somaDias(ate, -(dias - 1));

    const inicio = horaLocalParaUtc(de, "00:00", timezone);
    const fim = horaLocalParaUtc(somaDias(ate, 1), "00:00", timezone);
    const agora = new Date();

    const [quadras, reservas, proximas] = await Promise.all([
      this.prisma.quadra.findMany({
        where: { estabelecimentoId, ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      this.prisma.reserva.findMany({
        where: {
          estabelecimentoId,
          inicio: { gte: inicio, lt: fim },
        },
        select: PARA_O_PAINEL,
      }),
      this.prisma.reserva.findMany({
        where: {
          estabelecimentoId,
          status: { in: VENDIDAS },
          inicio: { gte: agora },
        },
        select: PARA_O_PAINEL,
        orderBy: { inicio: "asc" },
        take: 5,
      }),
    ]);

    const vendidas = reservas.filter((r) => VENDIDAS.includes(r.status));
    const canceladas = reservas.filter(
      (r) => r.status === ReservaStatus.CANCELADA,
    );
    const bloqueios = reservas.filter(
      (r) => r.status === ReservaStatus.BLOQUEIO,
    );

    const horasAbertas = this.horasAbertas(horarios, de, dias);
    const capacidade = horasAbertas * quadras.length;
    const horasVendidas = somaHoras(vendidas);

    return {
      periodo: { de, ate, dias },
      receita: this.receita(vendidas),
      ocupacao: {
        // Sem horário de funcionamento cadastrado não há denominador — e um
        // "0%" aqui mentiria dizendo que a arena está vazia.
        percentual:
          capacidade === 0
            ? null
            : Number(((horasVendidas / capacidade) * 100).toFixed(1)),
        horasVendidas: Number(horasVendidas.toFixed(1)),
        horasDisponiveis: Number(capacidade.toFixed(1)),
      },
      reservas: {
        vendidas: vendidas.length,
        canceladas: canceladas.length,
        bloqueios: bloqueios.length,
        // Sobre o total decidido, não sobre o que sobrou: cancelamento é
        // um evento do período, e dividir só pelas vendidas esconderia
        // exatamente o que a métrica existe para mostrar.
        taxaCancelamento:
          vendidas.length + canceladas.length === 0
            ? null
            : Number(
                (
                  (canceladas.length /
                    (vendidas.length + canceladas.length)) *
                  100
                ).toFixed(1),
              ),
      },
      porQuadra: this.porQuadra(quadras, vendidas, horasAbertas),
      proximosJogos: proximas.map((r) => this.jogo(r, timezone)),
    };
  }

  /**
   * Receita do período, separada pelo que já entrou e pelo que ainda pode
   * não entrar.
   *
   * Somar tudo num número só faria um Pix pendente parecer dinheiro em
   * caixa — e Pix pendente expira.
   */
  private receita(vendidas: ReservaDoPainel[]) {
    let paga = 0;
    let aReceber = 0;
    for (const r of vendidas) {
      const valor = Number(r.preco);
      if (r.pagamento?.status === PagamentoStatus.PAGO) paga += valor;
      else aReceber += valor;
    }
    return {
      paga: Number(paga.toFixed(2)),
      aReceber: Number(aReceber.toFixed(2)),
      total: Number((paga + aReceber).toFixed(2)),
      ticketMedio:
        vendidas.length === 0
          ? null
          : Number(((paga + aReceber) / vendidas.length).toFixed(2)),
    };
  }

  private porQuadra(
    quadras: { id: string; nome: string }[],
    vendidas: ReservaDoPainel[],
    horasAbertas: number,
  ) {
    return quadras
      .map((q) => {
        const daQuadra = vendidas.filter((r) => r.quadraId === q.id);
        const horas = somaHoras(daQuadra);
        return {
          quadraId: q.id,
          nome: q.nome,
          reservas: daQuadra.length,
          horasVendidas: Number(horas.toFixed(1)),
          receita: Number(
            daQuadra.reduce((s, r) => s + Number(r.preco), 0).toFixed(2),
          ),
          ocupacao:
            horasAbertas === 0
              ? null
              : Number(((horas / horasAbertas) * 100).toFixed(1)),
        };
      })
      .sort((a, b) => b.receita - a.receita);
  }

  private jogo(r: ReservaDoPainel, timezone: string) {
    return {
      id: r.id,
      quadraNome: r.quadra.nome,
      clienteNome: r.cliente?.nome ?? null,
      inicio: r.inicio.toISOString(),
      horaInicio: rotuloHoraLocal(r.inicio, timezone),
      horaFim: rotuloHoraLocal(r.fim, timezone),
      preco: Number(r.preco),
      status: r.status,
      pago: r.pagamento?.status === PagamentoStatus.PAGO,
    };
  }

  /**
   * Horas de porta aberta no período, somando o horário de cada dia da
   * semana que o período atravessa.
   *
   * Contar `dias × 24` daria uma ocupação ridícula de baixa; contar um
   * horário fixo erraria em quem fecha mais cedo na segunda.
   */
  private horasAbertas(
    horarios: { diaSemana: number; abre: string; fecha: string }[],
    de: string,
    dias: number,
  ): number {
    if (horarios.length === 0) return 0;
    const porDia = new Map(horarios.map((h) => [h.diaSemana, h]));

    let total = 0;
    for (let i = 0; i < dias; i++) {
      const data = somaDias(de, i);
      const [ano, mes, dia] = data.split("-").map(Number);
      const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
      const h = porDia.get(semana);
      if (!h) continue; // fechado nesse dia
      const minutos = emMinutos(h.fecha) - emMinutos(h.abre);
      if (minutos > 0) total += minutos / 60;
    }
    return total;
  }
}

/** Horas ocupadas por um conjunto de reservas. */
function somaHoras(reservas: { inicio: Date; fim: Date }[]): number {
  return reservas.reduce(
    (s, r) => s + (r.fim.getTime() - r.inicio.getTime()) / 3_600_000,
    0,
  );
}

/** "2026-10-05" + n dias, respeitando fim de mês e ano bissexto. */
export function somaDias(data: string, n: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}
