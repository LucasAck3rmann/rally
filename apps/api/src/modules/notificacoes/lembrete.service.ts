// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable } from "@nestjs/common";
import { NotificacaoTipo, Prisma, ReservaStatus } from "@prisma/client";

import { rotuloHoraLocal } from "../../common/timezone";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "./notificacoes.service";

/**
 * Quantas horas antes do jogo o lembrete sai.
 *
 * Três horas: cedo o bastante para quem precisa sair de casa se organizar,
 * tarde o bastante para a mensagem ainda ser sobre hoje. Um lembrete de
 * véspera vira aviso que se esquece; um de quinze minutos chega quando a
 * pessoa já está a caminho ou já desistiu.
 *
 * É constante e não coluna do estabelecimento de propósito. O projeto já tem
 * configuração por arena onde ela muda a regra de negócio — prazo de
 * cancelamento, desconto do Pix, validade do Pix. Esta é preferência de
 * comunicação, ninguém pediu para variar, e uma coluna a mais custa migração
 * e tela. Quando alguém pedir, vira coluna.
 */
const HORAS_ANTES = 3;

/** O que o lembrete precisa saber da reserva. */
const PARA_O_LEMBRETE = {
  id: true,
  inicio: true,
  clienteId: true,
  quadra: {
    select: {
      nome: true,
      estabelecimento: { select: { nome: true, timezone: true } },
    },
  },
} satisfies Prisma.ReservaSelect;

type ReservaDoLembrete = Prisma.ReservaGetPayload<{
  select: typeof PARA_O_LEMBRETE;
}>;

/**
 * Lembrete antes do jogo (RF-17).
 *
 * O requisito fala em WhatsApp e push, e **nenhum dos dois existe**: ambos
 * dependem de serviço contratado. O que existe são os dois canais já de pé —
 * o aviso in-app e o e-mail — e é por eles que o lembrete sai. A lacuna que
 * resta é de canal, não de gatilho, e isso é uma diferença que vale dizer:
 * acrescentar WhatsApp depois é um adaptador atrás da porta que já existe,
 * não um recurso novo.
 *
 * A matriz de rastreabilidade registrava que o lembrete "exige agendamento
 * (Redis/BullMQ), que está na arquitetura e não implementado". Deixou de ser
 * verdade quando o agendador entrou para expirar Pix: `@nestjs/schedule` já
 * roda neste processo, e uma fila externa seria infraestrutura a mais para
 * uma varredura que custa uma consulta indexada.
 */
@Injectable()
export class LembreteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * Avisa quem joga nas próximas {@link HORAS_ANTES} horas, uma vez só.
   *
   * Devolve quantos avisos saíram.
   */
  async enviarPendentes(agora = new Date()): Promise<number> {
    const limite = new Date(agora.getTime() + HORAS_ANTES * 60 * 60 * 1000);

    const candidatas = await this.prisma.reserva.findMany({
      where: {
        // Só confirmada: lembrar de um jogo que ainda não foi pago seria
        // cobrar disfarçado de lembrete, e o aviso de pagamento pendente é
        // outro assunto, com outro texto.
        status: ReservaStatus.CONFIRMADA,
        lembreteEnviadoEm: null,
        // Entre agora e o limite: o que já começou não se lembra, e o que
        // está além da janela ainda terá sua vez numa passagem seguinte.
        inicio: { gt: agora, lte: limite },
        clienteId: { not: null },
      },
      select: PARA_O_LEMBRETE,
      // Teto por passagem: uma arena que confirma trezentas reservas de uma
      // vez não deve virar trezentos envios num tique só.
      take: 200,
      orderBy: { inicio: "asc" },
    });

    let enviados = 0;
    for (const reserva of candidatas) {
      if (await this.marcarComoEnviado(reserva.id, agora)) {
        await this.avisar(reserva);
        enviados++;
      }
    }
    return enviados;
  }

  /**
   * Marca o envio **antes** de avisar, e só segue quem ganhou a marcação.
   *
   * O filtro por `lembreteEnviadoEm: null` é o que resolve a corrida entre
   * duas passagens que se sobreponham: as duas leem a mesma reserva, as duas
   * tentam marcar, e só uma sai com `count: 1`.
   *
   * A ordem custa uma falha possível — se o aviso estourar depois da marca,
   * aquele lembrete se perde. É o lado certo para errar: perder um lembrete
   * é um aborrecimento, mandar o mesmo aviso de dez em dez minutos durante
   * três horas é motivo para desinstalar o aplicativo.
   */
  private async marcarComoEnviado(id: string, agora: Date): Promise<boolean> {
    const { count } = await this.prisma.reserva.updateMany({
      where: { id, lembreteEnviadoEm: null },
      data: { lembreteEnviadoEm: agora },
    });
    return count === 1;
  }

  private async avisar(reserva: ReservaDoLembrete): Promise<void> {
    const est = reserva.quadra.estabelecimento;
    // Hora no fuso da arena, e não no do servidor: o jogo é lá.
    const hora = rotuloHoraLocal(reserva.inicio, est.timezone);

    await this.notificacoes.registrar({
      usuarioId: reserva.clienteId!,
      tipo: NotificacaoTipo.LEMBRETE,
      titulo: `Seu jogo é às ${hora}`,
      corpo: `${est.nome} · ${reserva.quadra.nome}`,
      destino: `/reservas/${reserva.id}/confirmacao`,
      email: {
        assunto: `Lembrete: seu jogo hoje às ${hora}`,
        texto:
          `Seu horário está confirmado para hoje às ${hora}.\n\n` +
          `Local: ${est.nome}\n` +
          `Quadra: ${reserva.quadra.nome}\n\n` +
          `Bom jogo!`,
      },
    });
  }
}
