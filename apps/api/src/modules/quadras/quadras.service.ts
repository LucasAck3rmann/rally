// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import {
  deMinutos,
  diaDaSemana,
  emMinutos,
  horaLocalParaUtc,
  rotuloHoraLocal,
} from "../../common/timezone";
import { ConciliacaoService } from "../conciliacao/conciliacao.service";
import { ListarQuadrasDto } from "./dto/listar-quadras.dto";

/** Status que ocupam o horário na agenda (cancelada libera o slot de volta). */
const STATUS_OCUPAM: ReservaStatus[] = [
  ReservaStatus.PENDENTE_PAGAMENTO,
  ReservaStatus.CONFIRMADA,
  ReservaStatus.CONCLUIDA,
  ReservaStatus.NO_SHOW,
  ReservaStatus.BLOQUEIO,
];

/** Uma faixa de horário na grade do dia, como o app consome. */
export interface SlotDisponibilidade {
  inicio: string;
  fim: string;
  hora: string;
  disponivel: boolean;
  preco: number;
}

const RESUMO = {
  id: true,
  nome: true,
  precoHora: true,
  fotos: true,
  capacidade: true,
  modalidades: { select: { nome: true } },
  estabelecimento: {
    select: {
      id: true,
      nome: true,
      slug: true,
      bairro: true,
      cidade: true,
      uf: true,
      nota: true,
      avaliacoes: true,
      descontoPixPct: true,
    },
  },
} satisfies Prisma.QuadraSelect;

@Injectable()
export class QuadrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conciliacao: ConciliacaoService,
  ) {}

  /** Vitrine da Home do cliente: quadras ativas, filtradas por modalidade/busca. */
  async listar(filtros: ListarQuadrasDto) {
    const busca = filtros.busca?.trim();

    const quadras = await this.prisma.quadra.findMany({
      where: {
        ativo: true,
        estabelecimento: { ativo: true },
        ...(filtros.modalidade ? { modalidades: { some: { nome: filtros.modalidade } } } : {}),
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: "insensitive" } },
                {
                  estabelecimento: {
                    nome: { contains: busca, mode: "insensitive" },
                  },
                },
                {
                  estabelecimento: {
                    bairro: { contains: busca, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      select: RESUMO,
      orderBy: [{ estabelecimento: { nome: "asc" } }, { nome: "asc" }],
      take: 50,
    });

    // Selo "ao vivo" dos cards: quadras com jogo acontecendo neste momento.
    const agora = new Date();
    const emJogo = await this.prisma.reserva.findMany({
      where: {
        quadraId: { in: quadras.map((q) => q.id) },
        status: ReservaStatus.CONFIRMADA,
        inicio: { lte: agora },
        fim: { gt: agora },
      },
      select: { quadraId: true },
    });
    const aoVivo = new Set(emJogo.map((r) => r.quadraId));

    return quadras.map((q) => ({
      ...this.paraResumo(q),
      aoVivo: aoVivo.has(q.id),
    }));
  }

  /** Detalhe da quadra (tela "Detalhe da Quadra"). */
  async detalhe(id: string) {
    const quadra = await this.prisma.quadra.findFirst({
      where: { id, ativo: true },
      select: {
        ...RESUMO,
        descricao: true,
        comodidades: true,
      },
    });
    if (!quadra) {
      throw new NotFoundException("Quadra não encontrada.");
    }
    return {
      ...this.paraResumo(quadra),
      descricao: quadra.descricao,
      comodidades: quadra.comodidades,
    };
  }

  /**
   * Grade de horários de um dia (RF-07).
   *
   * Um slot fica indisponível quando: cai fora do funcionamento, colide com uma
   * reserva/bloqueio existente, ou está dentro da antecedência mínima. O preço
   * sai da faixa de preço aplicável e cai no preço-base da quadra se não houver.
   */
  /**
   * Grade do dia de uma quadra.
   *
   * Antes de montar, **libera os horários cujo Pix expirou** (RN-13).
   * `PENDENTE_PAGAMENTO` ocupa o slot, e a `reserva_sem_sobreposicao` impede
   * outra reserva no mesmo intervalo enquanto a linha não estiver
   * `CANCELADA` — então marcar o slot como livre sem cancelar daria 409 na
   * cara do próximo cliente. Até 02/10 nada expirava nada, e um checkout
   * abandonado prendia o horário **para sempre**.
   *
   * Sim, é escrita no caminho de leitura. É expiração preguiçosa: sem
   * agendador no projeto, a alternativa era deixar o defeito de pé. Quando
   * houver `@nestjs/schedule`, isto passa a ser rede de segurança em vez de
   * mecanismo principal.
   */
  async disponibilidade(quadraId: string, data: string) {
    await this.conciliacao.expirarPendentes({ quadraId });

    const quadra = await this.prisma.quadra.findFirst({
      where: { id: quadraId, ativo: true },
      select: {
        id: true,
        precoHora: true,
        faixasPreco: true,
        estabelecimento: {
          select: {
            timezone: true,
            slotMinutos: true,
            antecedenciaMinHoras: true,
            antecedenciaMaxDias: true,
            horarios: true,
          },
        },
      },
    });
    if (!quadra) {
      throw new NotFoundException("Quadra não encontrada.");
    }

    const est = quadra.estabelecimento;
    const dia = diaDaSemana(data);
    const funcionamento = est.horarios.find((h) => h.diaSemana === dia);
    if (!funcionamento) {
      return { data, slotMinutos: est.slotMinutos, slots: [] };
    }

    const inicioDoDia = emMinutos(funcionamento.abre);
    const fimDoDia = emMinutos(funcionamento.fecha);
    const passo = est.slotMinutos;

    // Reservas do dia — uma consulta só, comparada em memória.
    const abreUtc = horaLocalParaUtc(data, funcionamento.abre, est.timezone);
    const fechaUtc = horaLocalParaUtc(data, funcionamento.fecha, est.timezone);
    const ocupadas = await this.prisma.reserva.findMany({
      where: {
        quadraId,
        status: { in: STATUS_OCUPAM },
        inicio: { lt: fechaUtc },
        fim: { gt: abreUtc },
      },
      select: { inicio: true, fim: true },
    });

    const agora = Date.now();
    const minimoEm = agora + est.antecedenciaMinHoras * 60 * 60 * 1000;
    const maximoEm = agora + est.antecedenciaMaxDias * 24 * 60 * 60 * 1000;

    const slots: SlotDisponibilidade[] = [];
    for (let m = inicioDoDia; m + passo <= fimDoDia; m += passo) {
      const horaInicio = deMinutos(m);
      const inicio = horaLocalParaUtc(data, horaInicio, est.timezone);
      const fim = new Date(inicio.getTime() + passo * 60 * 1000);

      const colide = ocupadas.some((r) => r.inicio < fim && r.fim > inicio);
      const cedoDemais = inicio.getTime() < minimoEm;
      const longeDemais = inicio.getTime() > maximoEm;

      slots.push({
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        hora: rotuloHoraLocal(inicio, est.timezone),
        disponivel: !colide && !cedoDemais && !longeDemais,
        preco: this.precoDoSlot(quadra, dia, m, passo),
      });
    }

    return { data, slotMinutos: passo, slots };
  }

  /** Preço proporcional ao slot, da faixa aplicável ou do preço-base da quadra. */
  private precoDoSlot(
    quadra: {
      precoHora: Prisma.Decimal;
      faixasPreco: {
        diaSemana: number | null;
        horaInicio: string;
        horaFim: string;
        precoHora: Prisma.Decimal;
      }[];
    },
    dia: number,
    minutoInicial: number,
    passo: number,
  ): number {
    const faixa = quadra.faixasPreco.find(
      (f) =>
        (f.diaSemana === null || f.diaSemana === dia) &&
        minutoInicial >= emMinutos(f.horaInicio) &&
        minutoInicial < emMinutos(f.horaFim),
    );
    const porHora = Number(faixa?.precoHora ?? quadra.precoHora);
    return Number(((porHora * passo) / 60).toFixed(2));
  }

  /** Achata o formato do Prisma no contrato que o app consome. */
  private paraResumo(q: {
    id: string;
    nome: string;
    precoHora: Prisma.Decimal;
    fotos: string[];
    capacidade: number | null;
    modalidades: { nome: string }[];
    estabelecimento: {
      id: string;
      nome: string;
      slug: string;
      bairro: string | null;
      cidade: string | null;
      uf: string | null;
      nota: Prisma.Decimal | null;
      avaliacoes: number;
      descontoPixPct: Prisma.Decimal;
    };
  }) {
    return {
      id: q.id,
      nome: q.nome,
      precoHora: Number(q.precoHora),
      fotos: q.fotos,
      capacidade: q.capacidade,
      modalidades: q.modalidades.map((m) => m.nome),
      estabelecimento: {
        ...q.estabelecimento,
        nota: q.estabelecimento.nota === null ? null : Number(q.estabelecimento.nota),
        descontoPixPct: Number(q.estabelecimento.descontoPixPct),
      },
    };
  }
}
