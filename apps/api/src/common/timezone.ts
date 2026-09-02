// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Conversões entre a hora **local do estabelecimento** e instantes UTC.
 *
 * A agenda é sempre pensada em hora local ("19:00 de terça"), mas o banco guarda
 * `DateTime` em UTC. Estas funções fazem a ponte sem depender de biblioteca de
 * fuso: usam o próprio ICU do Node (`Intl`), que já conhece o histórico de DST.
 */

/** Deslocamento (ms) do fuso em relação a UTC no instante informado. */
function deslocamentoDoFuso(quando: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(quando);

  const p: Record<string, string> = {};
  for (const parte of partes) p[parte.type] = parte.value;

  const comoSeFosseUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24, // algumas versões formatam meia-noite como "24"
    Number(p.minute),
    Number(p.second),
  );
  return comoSeFosseUtc - quando.getTime();
}

/**
 * Instante UTC correspondente a uma hora de parede local.
 * `data` = "YYYY-MM-DD", `hora` = "HH:mm".
 *
 * Aplica a correção duas vezes: a primeira usa o deslocamento do palpite e a
 * segunda o do instante já corrigido — o que acerta também as viradas de DST.
 */
export function horaLocalParaUtc(data: string, hora: string, timeZone: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);

  const palpite = Date.UTC(ano, mes - 1, dia, h, m);
  let instante = palpite - deslocamentoDoFuso(new Date(palpite), timeZone);
  instante = palpite - deslocamentoDoFuso(new Date(instante), timeZone);
  return new Date(instante);
}

/** Rótulo "HH:mm" de um instante UTC na hora local do estabelecimento. */
export function rotuloHoraLocal(quando: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(quando);
}

/** Dia da semana (0 = domingo) de uma data-calendário "YYYY-MM-DD". */
export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Data-calendário "YYYY-MM-DD" de hoje na hora local do estabelecimento. */
export function hojeLocal(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Minutos desde a meia-noite de um "HH:mm". */
export function emMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** "HH:mm" a partir de minutos desde a meia-noite. */
export function deMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
