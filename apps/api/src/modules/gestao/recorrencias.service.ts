// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  RecorrenciaStatus,
  ReservaOrigem,
  ReservaStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { horaLocalParaUtc } from "../../common/timezone";
import { ehConflitoDeHorario } from "../reservas/reservas.service";
import { CriarRecorrenciaDto, EditarRecorrenciaDto } from "./dto/recorrencia.dto";

/**
 * Quantas semanas à frente as ocorrências são materializadas.
 *
 * Oito semanas cobrem dois meses, que é o horizonte em que um gestor de arena
 * de fato enxerga a agenda. Mais que isso enche a tabela de reservas que quase
 * certamente serão canceladas; menos que isso faz a grade parecer livre num
 * horário que tem dono.
 */
export const SEMANAS_DE_HORIZONTE = 8;

/** Uma semana que não coube, com o motivo, para o gestor decidir. */
export type SemanaPulada = { data: string; motivo: string };

const DA_SERIE = {
  id: true,
  quadraId: true,
  clienteId: true,
  estabelecimentoId: true,
  diaSemana: true,
  horaInicio: true,
  duracaoMinutos: true,
  vigenciaInicio: true,
  vigenciaFim: true,
  preco: true,
  status: true,
  materializadaAte: true,
  observacao: true,
  quadra: { select: { nome: true } },
  cliente: { select: { nome: true, email: true } },
} satisfies Prisma.RecorrenciaSelect;

/**
 * Mensalistas: séries semanais que materializam reservas reais (ADR-0014).
 *
 * **Por que materializar.** O anti-overbooking do Rally não está em código de
 * aplicação: está na restrição `reserva_sem_sobreposicao`, que protege **linha
 * que existe**. Uma série virtual, aplicada só na leitura da grade, não teria
 * linha — e outro cliente reservaria por cima com o banco concordando.
 */
@Injectable()
export class RecorrenciasService {
  private readonly log = new Logger(RecorrenciasService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(estabelecimentoId: string) {
    const series = await this.prisma.recorrencia.findMany({
      where: { estabelecimentoId },
      select: DA_SERIE,
      orderBy: [{ status: "asc" }, { diaSemana: "asc" }, { horaInicio: "asc" }],
    });
    return series.map((s) => this.paraDto(s));
  }

  async criar(estabelecimentoId: string, dto: CriarRecorrenciaDto) {
    // A quadra é conferida **dentro** do estabelecimento da rota: sem isso,
    // um admin de uma arena criaria mensalista na quadra de outra pelo id.
    const quadra = await this.prisma.quadra.findFirst({
      where: { id: dto.quadraId, estabelecimentoId },
      select: { id: true },
    });
    if (!quadra) throw new NotFoundException("Quadra não encontrada.");

    const cliente = await this.prisma.usuario.findUnique({
      where: { id: dto.clienteId },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException("Cliente não encontrado.");

    const inicio = this.soData(dto.vigenciaInicio, "vigenciaInicio");
    const fim = dto.vigenciaFim ? this.soData(dto.vigenciaFim, "vigenciaFim") : null;
    if (fim && fim < inicio) {
      throw new BadRequestException("A vigência termina antes de começar.");
    }

    const serie = await this.prisma.recorrencia.create({
      data: {
        estabelecimentoId,
        quadraId: dto.quadraId,
        clienteId: dto.clienteId,
        diaSemana: dto.diaSemana,
        horaInicio: dto.horaInicio,
        duracaoMinutos: dto.duracaoMinutos,
        vigenciaInicio: inicio,
        vigenciaFim: fim,
        preco: new Prisma.Decimal(dto.preco),
        observacao: dto.observacao,
      },
      select: DA_SERIE,
    });

    const resultado = await this.materializar(serie.id);
    return { ...this.paraDto(serie), ...resultado };
  }

  /**
   * Cria as ocorrências que faltam, até o horizonte.
   *
   * **Colisão pula a semana e reporta.** Recusar a série inteira
   * transformaria um conflito de uma semana em bloqueio de meses, e o gestor
   * resolveria fora do sistema — que é o comportamento que a pesquisa mostra
   * existir hoje, no WhatsApp. Deslocar a reserva conflitante moveria o
   * horário de um cliente para acomodar outro sem que nenhum soubesse.
   */
  async materializar(recorrenciaId: string, agora = new Date()) {
    const serie = await this.prisma.recorrencia.findUnique({
      where: { id: recorrenciaId },
      select: { ...DA_SERIE, estabelecimento: { select: { timezone: true } } },
    });
    if (!serie) throw new NotFoundException("Série não encontrada.");

    if (serie.status !== RecorrenciaStatus.ATIVA) {
      return { criadas: 0, puladas: [] as SemanaPulada[] };
    }

    const timezone = serie.estabelecimento.timezone;
    const horizonte = new Date(agora);
    horizonte.setUTCDate(horizonte.getUTCDate() + SEMANAS_DE_HORIZONTE * 7);

    const puladas: SemanaPulada[] = [];
    let criadas = 0;
    let ultima: Date | null = serie.materializadaAte;

    for (const data of this.datasAte(serie, horizonte, agora)) {
      const inicio = horaLocalParaUtc(data, serie.horaInicio, timezone);
      const fim = new Date(inicio.getTime() + serie.duracaoMinutos * 60_000);
      // **Ocorrência cujo horário já passou não é criada.** O dia pode ser
      // hoje e o horário já ter acontecido — uma série das 19h materializada
      // às 20h geraria uma reserva no passado, que entraria no relatório como
      // receita de um jogo que ninguém jogou.
      if (inicio <= agora) continue;
      try {
        await this.prisma.reserva.create({
          data: {
            estabelecimentoId: serie.estabelecimentoId,
            quadraId: serie.quadraId,
            clienteId: serie.clienteId,
            inicio,
            fim,
            // Confirmada porque o horário **tem dono**: o mensalista paga por
            // acordo mensal, fora do fluxo de cobrança por reserva. Deixá-la
            // pendente faria a expiração de Pix liberar o horário dele.
            status: ReservaStatus.CONFIRMADA,
            origem: ReservaOrigem.BALCAO,
            // Preço congelado na reserva, como manda a RN-12: reajuste da
            // série vale para as próximas, nunca para as já geradas.
            preco: serie.preco,
            recorrenciaId: serie.id,
          },
          select: { id: true },
        });
        criadas++;
        ultima = inicio;
      } catch (erro) {
        if (!ehConflitoDeHorario(erro)) throw erro;
        puladas.push({
          data,
          motivo: "o horário já estava ocupado nessa semana",
        });
        // A semana pulada **não** avança `materializadaAte`: se ela avançasse,
        // uma colisão na última semana do horizonte faria o sistema achar que
        // materializou até lá, e a semana seguinte nunca seria tentada.
      }
    }

    if (ultima && ultima !== serie.materializadaAte) {
      await this.prisma.recorrencia.update({
        where: { id: serie.id },
        data: { materializadaAte: ultima },
      });
    }
    if (puladas.length) {
      this.log.warn(
        `Série ${serie.id}: ${puladas.length} semana(s) pulada(s) por conflito.`,
      );
    }
    return { criadas, puladas };
  }

  async editar(
    estabelecimentoId: string,
    id: string,
    dto: EditarRecorrenciaDto,
  ) {
    const serie = await this.achar(estabelecimentoId, id);
    const atualizada = await this.prisma.recorrencia.update({
      where: { id: serie.id },
      data: {
        ...(dto.preco !== undefined ? { preco: new Prisma.Decimal(dto.preco) } : {}),
        ...(dto.vigenciaFim !== undefined
          ? { vigenciaFim: this.soData(dto.vigenciaFim, "vigenciaFim") }
          : {}),
        ...(dto.observacao !== undefined ? { observacao: dto.observacao } : {}),
      },
      select: DA_SERIE,
    });
    return this.paraDto(atualizada);
  }

  /**
   * Encerra a série e cancela o que ainda não aconteceu.
   *
   * **As ocorrências passadas ficam.** Elas são o histórico que o relatório
   * usa para fechar o mês, e apagá-las mudaria a receita de um período já
   * encerrado. As futuras são canceladas com motivo, e não apagadas, pela
   * mesma razão que vale para qualquer reserva de cliente.
   */
  async encerrar(estabelecimentoId: string, id: string, agora = new Date()) {
    const serie = await this.achar(estabelecimentoId, id);

    const canceladas = await this.prisma.reserva.updateMany({
      where: {
        recorrenciaId: serie.id,
        inicio: { gte: agora },
        status: { in: [ReservaStatus.CONFIRMADA, ReservaStatus.PENDENTE_PAGAMENTO] },
      },
      data: {
        status: ReservaStatus.CANCELADA,
        canceladaEm: agora,
        motivoCancelamento: "Mensalidade encerrada.",
      },
    });

    const encerrada = await this.prisma.recorrencia.update({
      where: { id: serie.id },
      data: { status: RecorrenciaStatus.ENCERRADA },
      select: DA_SERIE,
    });
    return { ...this.paraDto(encerrada), canceladas: canceladas.count };
  }

  // ── apoio ────────────────────────────────────────────────────────────────

  private async achar(estabelecimentoId: string, id: string) {
    const serie = await this.prisma.recorrencia.findFirst({
      where: { id, estabelecimentoId },
      select: DA_SERIE,
    });
    if (!serie) throw new NotFoundException("Série não encontrada.");
    return serie;
  }

  /** "2026-10-20" a partir de um ISO, recusando data inválida. */
  private soData(iso: string, campo: string): Date {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${campo} inválida.`);
    }
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  /**
   * As data-calendário que ainda faltam materializar, em ordem.
   *
   * Começa depois do que já foi feito, nunca no passado, e respeita a
   * vigência. Trabalha em UTC de propósito: é aritmética de calendário —
   * somar sete dias —, e não de relógio, de modo que horário de verão não
   * empurra a data para o dia anterior.
   */
  private datasAte(
    serie: {
      diaSemana: number;
      vigenciaInicio: Date;
      vigenciaFim: Date | null;
      materializadaAte: Date | null;
    },
    horizonte: Date,
    agora: Date,
  ): string[] {
    const piso = [serie.vigenciaInicio, agora, serie.materializadaAte]
      .filter((d): d is Date => d !== null)
      .reduce((a, b) => (a > b ? a : b));

    const d = new Date(
      Date.UTC(piso.getUTCFullYear(), piso.getUTCMonth(), piso.getUTCDate()),
    );
    // Anda até o próximo dia da semana pedido. O `+ 1` evita repetir o dia
    // que já foi materializado, quando `materializadaAte` cai nele.
    if (serie.materializadaAte && d <= serie.materializadaAte) {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    while (d.getUTCDay() !== serie.diaSemana) {
      d.setUTCDate(d.getUTCDate() + 1);
    }

    const datas: string[] = [];
    while (d <= horizonte) {
      if (serie.vigenciaFim && d > serie.vigenciaFim) break;
      datas.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return datas;
  }

  private paraDto(s: Prisma.RecorrenciaGetPayload<{ select: typeof DA_SERIE }>) {
    return {
      id: s.id,
      quadraId: s.quadraId,
      quadra: s.quadra.nome,
      clienteId: s.clienteId,
      cliente: s.cliente.nome,
      diaSemana: s.diaSemana,
      horaInicio: s.horaInicio,
      duracaoMinutos: s.duracaoMinutos,
      vigenciaInicio: s.vigenciaInicio.toISOString().slice(0, 10),
      vigenciaFim: s.vigenciaFim?.toISOString().slice(0, 10) ?? null,
      preco: Number(s.preco),
      status: s.status,
      /**
       * Até quando as ocorrências já foram criadas.
       *
       * É a **medida** da mitigação do ADR-0014: se o trabalho agendado
       * falhar, as ocorrências deixam de nascer em silêncio e o horário
       * aparece livre. A distância entre isto e o horizonte esperado é o
       * número que denuncia a falha.
       */
      materializadaAte: s.materializadaAte?.toISOString().slice(0, 10) ?? null,
      observacao: s.observacao,
    };
  }
}
