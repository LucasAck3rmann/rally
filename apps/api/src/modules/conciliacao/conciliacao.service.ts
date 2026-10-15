// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PagamentoStatus, Prisma, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * Conciliação entre reserva e pagamento (RF-29, RNF-10).
 *
 * Não é conciliação contra extrato de gateway — isso depende de credencial
 * da AbacatePay, que o projeto ainda não tem (ADR-0013). É a conciliação
 * **interna**: encontrar os pares reserva↔pagamento que não fecham.
 *
 * Cada divergência aqui é um estado que o sistema **não deveria** produzir.
 * Quando aparece uma, o valor do relatório não é a estatística: é o nome do
 * defeito que a gerou.
 */
const PARA_CONCILIAR = {
  id: true,
  status: true,
  preco: true,
  inicio: true,
  quadra: { select: { nome: true } },
  cliente: { select: { nome: true } },
  pagamento: {
    select: { status: true, valor: true, metodo: true, expiraEm: true },
  },
} satisfies Prisma.ReservaSelect;

@Injectable()
export class ConciliacaoService {
  private readonly logger = new Logger(ConciliacaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async relatorio(estabelecimentoId: string) {
    const existe = await this.prisma.estabelecimento.findUnique({
      where: { id: estabelecimentoId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException("Estabelecimento não encontrado.");

    const reservas = await this.prisma.reserva.findMany({
      // Bloqueio fica de fora: não tem cobrança e não tem o que conciliar.
      where: { estabelecimentoId, status: { not: ReservaStatus.BLOQUEIO } },
      select: PARA_CONCILIAR,
      orderBy: { inicio: "desc" },
    });

    const agora = new Date();
    const divergencias = reservas.flatMap((r) =>
      classificar(r, agora).map((tipo) => ({
        tipo,
        ...DESCRICOES[tipo],
        reservaId: r.id,
        // Mesmo formato de `reservas.service.ts`: o código não é coluna,
        // é derivado do id para o cliente ter o que ditar no balcão.
        codigo: `RALLY-${r.id.slice(-4).toUpperCase()}`,
        quadra: r.quadra.nome,
        cliente: r.cliente?.nome ?? null,
        inicio: r.inicio.toISOString(),
        statusReserva: r.status,
        statusPagamento: r.pagamento?.status ?? null,
        valorReserva: Number(r.preco),
        valorPagamento: r.pagamento ? Number(r.pagamento.valor) : null,
      })),
    );

    return {
      conferidas: reservas.length,
      divergencias,
      porTipo: contarPorTipo(divergencias),
      // O que o dono precisa ver primeiro: dinheiro devido a cliente e
      // horário preso sem pagamento são os dois que custam.
      graves: divergencias.filter((d) => d.gravidade === "grave").length,
    };
  }

  /**
   * Cancela as reservas cujo Pix expirou, devolvendo o horário para a venda
   * (RN-13).
   *
   * **O slot não se liberta sozinho.** `PENDENTE_PAGAMENTO` ocupa o horário
   * na grade, e a `reserva_sem_sobreposicao` impede outra reserva no mesmo
   * intervalo enquanto a linha não estiver `CANCELADA` — então mostrar o slot
   * como livre sem cancelar daria 409 na cara do próximo cliente. Liberar
   * exige escrever.
   *
   * Idempotente: roda duas vezes e a segunda não acha nada.
   */
  async expirarPendentes(filtro: {
    estabelecimentoId?: string;
    quadraId?: string;
  }): Promise<number> {
    const agora = new Date();
    const alvo = await this.prisma.reserva.findMany({
      where: {
        ...(filtro.estabelecimentoId
          ? { estabelecimentoId: filtro.estabelecimentoId }
          : {}),
        ...(filtro.quadraId ? { quadraId: filtro.quadraId } : {}),
        status: ReservaStatus.PENDENTE_PAGAMENTO,
        pagamento: {
          status: PagamentoStatus.PENDENTE,
          expiraEm: { lt: agora },
        },
      },
      select: { id: true },
    });
    if (alvo.length === 0) return 0;

    const ids = alvo.map((r) => r.id);
    await this.prisma.$transaction([
      this.prisma.reserva.updateMany({
        where: { id: { in: ids } },
        data: {
          status: ReservaStatus.CANCELADA,
          canceladaEm: agora,
          motivoCancelamento: "Pagamento Pix expirou sem confirmação.",
        },
      }),
      // O pagamento vira EXPIRADO junto: deixá-lo PENDENTE faria o
      // relatório de conciliação continuar acusando a mesma divergência
      // depois de ela ter sido resolvida.
      this.prisma.pagamento.updateMany({
        where: { reservaId: { in: ids } },
        data: { status: PagamentoStatus.EXPIRADO },
      }),
    ]);

    this.logger.log(`${ids.length} reserva(s) liberada(s) por Pix expirado.`);
    return ids.length;
  }
}

/** Tipos de divergência que a conciliação reconhece. */
export type TipoDeDivergencia =
  | "PENDENTE_EXPIRADA"
  | "CONFIRMADA_SEM_PAGAMENTO"
  | "PAGA_NAO_CONFIRMADA"
  | "CANCELADA_PAGA"
  | "VALOR_DIVERGENTE"
  | "SEM_COBRANCA";

type Gravidade = "grave" | "atencao";

const DESCRICOES: Record<
  TipoDeDivergencia,
  { descricao: string; gravidade: Gravidade }
> = {
  PENDENTE_EXPIRADA: {
    // Custa faturamento todo dia que passa: o horário está preso e ninguém
    // pode comprá-lo.
    descricao: "Pix expirou e a reserva continua ocupando o horário.",
    gravidade: "grave",
  },
  CANCELADA_PAGA: {
    // Dinheiro do cliente na mão do estabelecimento sem serviço prestado.
    descricao: "Reserva cancelada com pagamento confirmado — estorno devido.",
    gravidade: "grave",
  },
  PAGA_NAO_CONFIRMADA: {
    // O cliente pagou e a reserva não avançou: ele aparece e não tem vaga.
    descricao: "Pagamento confirmado e reserva ainda pendente.",
    gravidade: "grave",
  },
  VALOR_DIVERGENTE: {
    descricao: "Valor cobrado diferente do preço da reserva.",
    gravidade: "grave",
  },
  CONFIRMADA_SEM_PAGAMENTO: {
    // Normal em reserva de balcão, que é paga fora do sistema — por isso
    // "atenção" e não "grave".
    descricao: "Reserva confirmada sem pagamento confirmado.",
    gravidade: "atencao",
  },
  SEM_COBRANCA: {
    descricao: "Reserva sem cobrança associada.",
    gravidade: "atencao",
  },
};

type ReservaConciliada = {
  status: ReservaStatus;
  preco: Prisma.Decimal;
  pagamento: {
    status: PagamentoStatus;
    valor: Prisma.Decimal;
    expiraEm: Date | null;
  } | null;
};

/**
 * Classifica uma reserva. Devolve **lista** porque uma reserva pode acusar
 * mais de uma divergência ao mesmo tempo — valor errado e status errado são
 * problemas independentes.
 */
function classificar(r: ReservaConciliada, agora: Date): TipoDeDivergencia[] {
  const tipos: TipoDeDivergencia[] = [];
  const p = r.pagamento;

  if (!p) {
    if (r.status === ReservaStatus.PENDENTE_PAGAMENTO) tipos.push("SEM_COBRANCA");
    else if (r.status === ReservaStatus.CONFIRMADA) {
      tipos.push("CONFIRMADA_SEM_PAGAMENTO");
    }
    return tipos;
  }

  if (
    r.status === ReservaStatus.PENDENTE_PAGAMENTO &&
    p.status === PagamentoStatus.PENDENTE &&
    p.expiraEm !== null &&
    p.expiraEm < agora
  ) {
    tipos.push("PENDENTE_EXPIRADA");
  }

  if (
    r.status === ReservaStatus.PENDENTE_PAGAMENTO &&
    p.status === PagamentoStatus.PAGO
  ) {
    tipos.push("PAGA_NAO_CONFIRMADA");
  }

  if (r.status === ReservaStatus.CONFIRMADA && p.status !== PagamentoStatus.PAGO) {
    tipos.push("CONFIRMADA_SEM_PAGAMENTO");
  }

  if (r.status === ReservaStatus.CANCELADA && p.status === PagamentoStatus.PAGO) {
    tipos.push("CANCELADA_PAGA");
  }

  // Comparação em centavos: `0.1 + 0.2 !== 0.3` em ponto flutuante, e um
  // relatório que acusa divergência de 0,000001 não se usa.
  const centavosReserva = Math.round(Number(r.preco) * 100);
  const centavosPagamento = Math.round(Number(p.valor) * 100);
  if (
    centavosReserva !== centavosPagamento &&
    // Desconto do Pix (RN-03) faz a cobrança ser **menor** de propósito;
    // só o excesso é divergência.
    centavosPagamento > centavosReserva
  ) {
    tipos.push("VALOR_DIVERGENTE");
  }

  return tipos;
}

function contarPorTipo(divergencias: { tipo: TipoDeDivergencia }[]) {
  const contagem = new Map<TipoDeDivergencia, number>();
  for (const d of divergencias) {
    contagem.set(d.tipo, (contagem.get(d.tipo) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([tipo, quantidade]) => ({
      tipo,
      quantidade,
      ...DESCRICOES[tipo],
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}
