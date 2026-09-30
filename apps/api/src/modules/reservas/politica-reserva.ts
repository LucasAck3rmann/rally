// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException } from "@nestjs/common";
import { ReservaStatus } from "@prisma/client";

/**
 * Regras que cancelar e remarcar compartilham (RN-02).
 *
 * As duas operações nasceram em dias diferentes e cada uma trouxe sua cópia
 * das mesmas checagens; a conta da janela chegou a aparecer em três lugares.
 * Com um ponto de verdade só, uma mudança de política não corre o risco de
 * valer num caminho e não no outro.
 */

const HORA_MS = 60 * 60 * 1000;

/** Estados em que a reserva ainda aceita ser mexida. */
const ATIVAS: ReservaStatus[] = [
  ReservaStatus.PENDENTE_PAGAMENTO,
  ReservaStatus.CONFIRMADA,
];

/** O que a política precisa saber da reserva — nada além disto. */
export type ReservaSobPolitica = {
  inicio: Date;
  status: ReservaStatus;
};

/** Instante-limite para o ato ainda contar como dentro do prazo. */
export function limiteDoPrazo(inicio: Date, cancelamentoHoras: number): Date {
  return new Date(inicio.getTime() - cancelamentoHoras * HORA_MS);
}

/**
 * Se o ato acontece dentro da janela do estabelecimento.
 *
 * Fora dela o cancelamento ainda vale — o horário é liberado —, só não dá
 * direito a devolução. Já a remarcação é recusada, senão bastava empurrar a
 * reserva para longe e cancelar de graça depois.
 */
export function estaDentroDoPrazo(
  inicio: Date,
  cancelamentoHoras: number,
  agora: Date,
): boolean {
  return agora <= limiteDoPrazo(inicio, cancelamentoHoras);
}

/**
 * Recusa o que não pode mais ser mexido. `acao` entra na mensagem
 * ("cancelada" ou "remarcada").
 */
export function garantirQueAceitaMudanca(
  reserva: ReservaSobPolitica,
  agora: Date,
  acao: "cancelada" | "remarcada",
): void {
  if (reserva.status === ReservaStatus.CANCELADA) {
    throw new ConflictException("Esta reserva já foi cancelada.");
  }
  if (!ATIVAS.includes(reserva.status)) {
    throw new ConflictException(`Esta reserva não pode ser ${acao}.`);
  }
  if (reserva.inicio <= agora) {
    throw new ConflictException("O horário da reserva já começou.");
  }
}
