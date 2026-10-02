// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { NotificacaoTipo, Prisma, ReplayStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { IngestarReplayDto } from "./dto/ingestar-replay.dto";

/** Reservas que têm cliente de verdade — bloqueio e cancelada não têm. */
const COM_CLIENTE: ReservaStatus[] = [
  ReservaStatus.PENDENTE_PAGAMENTO,
  ReservaStatus.CONFIRMADA,
  ReservaStatus.CONCLUIDA,
  ReservaStatus.NO_SHOW,
];

/**
 * Ingestão de replay: liga o clipe à reserva e, por ela, ao cliente (RF-30).
 *
 * **É aqui que mora o diferencial declarado no ADR-0012.** A captação não é
 * construída internamente — vem de parceiro. O que o Rally faz, e o
 * fornecedor de vídeo não faz, é saber **de quem é o clipe**: a quadra e o
 * instante do lance identificam a reserva, e a reserva identifica a pessoa.
 * Sem esse vínculo, um clipe é um arquivo solto num bucket.
 */
@Injectable()
export class IngestaoDeReplaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async ingestar(dto: IngestarReplayDto) {
    const gravadoEm = new Date(dto.gravadoEm);
    if (Number.isNaN(gravadoEm.getTime())) {
      throw new BadRequestException("`gravadoEm` inválido.");
    }

    const quadra = await this.prisma.quadra.findUnique({
      where: { id: dto.quadraId },
      select: { id: true, estabelecimentoId: true },
    });
    if (!quadra) throw new NotFoundException("Quadra não encontrada.");

    // Idempotência: o provedor reentrega quando não recebe 2xx. Devolver o
    // que já existe é a resposta certa — criar um segundo seria duplicar o
    // mesmo vídeo na galeria do cliente.
    const existente = await this.prisma.replay.findUnique({
      where: { s3Key: dto.s3Key },
      select: SAIDA,
    });
    if (existente) return { ...this.paraDto(existente), jaExistia: true };

    const reserva = await this.reservaNoInstante(
      quadra.id,
      quadra.estabelecimentoId,
      gravadoEm,
    );

    try {
      const criado = await this.prisma.replay.create({
        data: {
          estabelecimentoId: quadra.estabelecimentoId,
          quadraId: quadra.id,
          // Clipe sem reserva no horário fica **órfão de propósito**: é
          // vídeo de quadra vazia, de aula avulsa ou de horário bloqueado.
          // Apagá-lo perderia material; inventar um dono seria pior.
          reservaId: reserva?.id ?? null,
          clienteId: reserva?.clienteId ?? null,
          s3Key: dto.s3Key,
          url: dto.url ?? null,
          duracaoSeg: dto.duracaoSeg ?? null,
          gravadoEm,
          status: dto.url ? ReplayStatus.PRONTO : ReplayStatus.PROCESSANDO,
        },
        select: SAIDA,
      });

      // Avisa só quem tem clipe pronto **e** dono: notificar sobre vídeo que
      // ainda está processando manda a pessoa para uma tela vazia.
      if (criado.clienteId && criado.status === ReplayStatus.PRONTO) {
        await this.notificacoes.registrar({
          usuarioId: criado.clienteId,
          tipo: NotificacaoTipo.REPLAY,
          titulo: "Seu replay está pronto",
          corpo: "O vídeo do seu último jogo já está disponível.",
          destino: "/replays",
        });
      }

      return { ...this.paraDto(criado), jaExistia: false };
    } catch (erro) {
      // Duas entregas simultâneas: a segunda perde no índice único. Devolver
      // o vencedor é o comportamento idempotente — o provedor pediu que o
      // clipe exista, e ele existe.
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2002"
      ) {
        const vencedor = await this.prisma.replay.findUnique({
          where: { s3Key: dto.s3Key },
          select: SAIDA,
        });
        if (vencedor) return { ...this.paraDto(vencedor), jaExistia: true };
      }
      throw erro;
    }
  }

  /**
   * A reserva que estava acontecendo naquela quadra, naquele instante.
   *
   * Intervalo fechado no início e aberto no fim (`inicio <= t < fim`): às
   * 20:00 em ponto o jogo das 19h já acabou e o das 20h começou, e sem essa
   * assimetria o clipe da virada casaria com os dois.
   *
   * Não há como dar empate: a `reserva_sem_sobreposicao` garante no banco
   * que duas reservas ativas não cobrem o mesmo instante na mesma quadra.
   */
  private async reservaNoInstante(
    quadraId: string,
    estabelecimentoId: string,
    quando: Date,
  ) {
    return this.prisma.reserva.findFirst({
      where: {
        quadraId,
        estabelecimentoId,
        status: { in: COM_CLIENTE },
        inicio: { lte: quando },
        fim: { gt: quando },
      },
      select: { id: true, clienteId: true },
    });
  }

  private paraDto(r: ReplayCriado) {
    return {
      id: r.id,
      quadraId: r.quadraId,
      reservaId: r.reservaId,
      clienteId: r.clienteId,
      status: r.status,
      // `true` quando o clipe achou dono: é o que o parceiro não sabe
      // responder, e o que o Rally existe para responder.
      vinculado: r.clienteId !== null,
      gravadoEm: r.gravadoEm?.toISOString() ?? null,
    };
  }
}

const SAIDA = {
  id: true,
  quadraId: true,
  reservaId: true,
  clienteId: true,
  status: true,
  gravadoEm: true,
} satisfies Prisma.ReplaySelect;

type ReplayCriado = Prisma.ReplayGetPayload<{ select: typeof SAIDA }>;
