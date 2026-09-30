// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, ReservaOrigem, ReservaStatus } from "@prisma/client";

import { horaLocalParaUtc, rotuloHoraLocal } from "../../common/timezone";
import { PrismaService } from "../../prisma/prisma.service";
import { ehConflitoDeHorario } from "../reservas/reservas.service";
import { CriarBloqueioDto } from "./dto/criar-bloqueio.dto";

/** Status que ocupam a quadra — os mesmos que a grade do cliente respeita. */
const OCUPAM = [
  ReservaStatus.PENDENTE_PAGAMENTO,
  ReservaStatus.CONFIRMADA,
  ReservaStatus.CONCLUIDA,
  ReservaStatus.NO_SHOW,
  ReservaStatus.BLOQUEIO,
];

const ITEM_DA_AGENDA = {
  id: true,
  inicio: true,
  fim: true,
  status: true,
  origem: true,
  preco: true,
  motivoCancelamento: true,
  quadra: { select: { id: true, nome: true } },
  cliente: { select: { id: true, nome: true, telefone: true } },
  pagamento: { select: { status: true, metodo: true } },
} satisfies Prisma.ReservaSelect;

type ItemDaAgenda = Prisma.ReservaGetPayload<{ select: typeof ITEM_DA_AGENDA }>;

/**
 * Agenda do estabelecimento e bloqueios de horário (RF-21).
 *
 * Um bloqueio é uma `Reserva` com status `BLOQUEIO`, sem cliente e com preço
 * zero. Guardar na mesma tabela é o que faz a `reserva_sem_sobreposicao`
 * valer **entre** reserva e bloqueio: numa tabela separada, o banco deixaria
 * bloquear um horário já reservado, e a trava contra overbooking pararia
 * exatamente onde o dono mais precisa dela.
 */
@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * O dia inteiro do estabelecimento, quadra a quadra.
   *
   * Vai do começo ao fim do dia **no fuso do estabelecimento** — uma arena em
   * Fernando de Noronha não fecha às 21h de Brasília.
   */
  async doDia(estabelecimentoId: string, data: string) {
    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: estabelecimentoId },
      select: { timezone: true },
    });
    if (!estabelecimento) {
      throw new NotFoundException("Estabelecimento não encontrado.");
    }

    const { inicio, fim } = janelaDoDia(data, estabelecimento.timezone);

    const [quadras, itens] = await Promise.all([
      this.prisma.quadra.findMany({
        where: { estabelecimentoId, ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      this.prisma.reserva.findMany({
        // O `estabelecimentoId` no where é o isolamento do ADR-0011: sem ele
        // a agenda de um tenant mostraria a reserva de outro.
        where: {
          estabelecimentoId,
          status: { in: OCUPAM },
          inicio: { lt: fim },
          fim: { gt: inicio },
        },
        select: ITEM_DA_AGENDA,
        orderBy: [{ inicio: "asc" }],
      }),
    ]);

    return {
      data,
      timezone: estabelecimento.timezone,
      quadras,
      itens: itens.map((i) => this.paraDto(i, estabelecimento.timezone)),
    };
  }

  /** Tira um horário da venda sem cobrar nada de ninguém (RN-09). */
  async criarBloqueio(estabelecimentoId: string, dto: CriarBloqueioDto) {
    const inicio = new Date(dto.inicio);
    const fim = new Date(dto.fim);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException("Datas inválidas.");
    }
    if (fim <= inicio) {
      throw new BadRequestException("O fim precisa ser depois do início.");
    }

    // A quadra é conferida **dentro** do estabelecimento da rota: sem isso,
    // um admin de uma arena bloquearia a quadra de outra pelo id.
    const quadra = await this.prisma.quadra.findFirst({
      where: { id: dto.quadraId, estabelecimentoId },
      select: { id: true },
    });
    if (!quadra) throw new NotFoundException("Quadra não encontrada.");

    const estabelecimento = await this.prisma.estabelecimento.findUnique({
      where: { id: estabelecimentoId },
      select: { timezone: true },
    });

    try {
      const criado = await this.prisma.reserva.create({
        data: {
          estabelecimentoId,
          quadraId: dto.quadraId,
          inicio,
          fim,
          status: ReservaStatus.BLOQUEIO,
          origem: ReservaOrigem.BALCAO,
          // Preço zero e sem `Pagamento`: é o que a RN-09 exige, e é o que
          // mantém o bloqueio fora de qualquer relatório de receita.
          preco: new Prisma.Decimal(0),
          motivoCancelamento: dto.motivo,
        },
        select: ITEM_DA_AGENDA,
      });
      return this.paraDto(criado, estabelecimento?.timezone ?? "UTC");
    } catch (erro) {
      if (ehConflitoDeHorario(erro)) {
        // A mesma trava que impede overbooking impede bloquear em cima de
        // uma reserva — de propósito: quem já pagou não perde o horário.
        throw new ConflictException(
          "Esse horário já tem reserva ou bloqueio. Cancele a reserva antes.",
        );
      }
      throw erro;
    }
  }

  /**
   * Libera o horário de volta para a venda.
   *
   * Bloqueio é apagado, e não cancelado: `CANCELADA` existe para preservar o
   * histórico de quem pagou, e bloqueio não tem histórico a preservar — se
   * ficasse como cancelado, sujaria os relatórios com linhas de preço zero.
   */
  async removerBloqueio(estabelecimentoId: string, bloqueioId: string) {
    const bloqueio = await this.prisma.reserva.findFirst({
      where: {
        id: bloqueioId,
        estabelecimentoId,
        status: ReservaStatus.BLOQUEIO,
      },
      select: { id: true },
    });
    if (!bloqueio) throw new NotFoundException("Bloqueio não encontrado.");

    await this.prisma.reserva.delete({ where: { id: bloqueioId } });
    return { id: bloqueioId, removido: true };
  }

  private paraDto(item: ItemDaAgenda, timezone: string) {
    const ehBloqueio = item.status === ReservaStatus.BLOQUEIO;
    return {
      id: item.id,
      quadraId: item.quadra.id,
      quadraNome: item.quadra.nome,
      inicio: item.inicio.toISOString(),
      fim: item.fim.toISOString(),
      horaInicio: rotuloHoraLocal(item.inicio, timezone),
      horaFim: rotuloHoraLocal(item.fim, timezone),
      status: item.status,
      origem: item.origem,
      ehBloqueio,
      // Bloqueio não tem valor nem cliente; devolver 0 e `null` evita que a
      // tela invente um "R$ 0,00" ou um nome de cliente vazio.
      preco: ehBloqueio ? null : Number(item.preco),
      motivo: ehBloqueio ? item.motivoCancelamento : null,
      cliente: ehBloqueio
        ? null
        : item.cliente && {
            id: item.cliente.id,
            nome: item.cliente.nome,
            telefone: item.cliente.telefone,
          },
      pagamento: item.pagamento,
    };
  }
}

/**
 * Começo e fim de `data` (YYYY-MM-DD) no fuso do estabelecimento, em UTC.
 *
 * O fim é a meia-noite do **dia seguinte no calendário**, não `início + 24h`:
 * na virada do horário de verão o dia tem 23 ou 25 horas, e somar 24 cortaria
 * ou repetiria uma hora da agenda.
 */
export function janelaDoDia(
  data: string,
  timeZone: string,
): { inicio: Date; fim: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new BadRequestException("Data inválida: use YYYY-MM-DD.");
  }
  return {
    inicio: horaLocalParaUtc(data, "00:00", timeZone),
    fim: horaLocalParaUtc(diaSeguinte(data), "00:00", timeZone),
  };
}

/** "2026-03-31" a partir de "2026-03-30", respeitando fim de mês e bissexto. */
function diaSeguinte(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const proximo = new Date(Date.UTC(ano, mes - 1, dia + 1));
  return proximo.toISOString().slice(0, 10);
}
