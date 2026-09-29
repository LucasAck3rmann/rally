// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Fuso das quadras enquanto a vitrine não devolve o do estabelecimento — hoje
 * só a reserva expõe `timezone`. Todos os estabelecimentos do seed são
 * brasileiros; quando a API trouxer o campo, ele entra no lugar desta constante.
 */
export const FUSO_PADRAO = "America/Sao_Paulo";

const dinheiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarPreco(valor: number): string {
  return dinheiro.format(valor);
}

/** Data de hoje no fuso da quadra, no formato que a API espera (YYYY-MM-DD). */
export function hojeNaQuadra(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_PADRAO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Os próximos `quantidade` dias a partir de hoje, em YYYY-MM-DD. */
export function proximosDias(quantidade: number, agora: Date = new Date()): string[] {
  const base = hojeNaQuadra(agora);
  const [ano, mes, dia] = base.split("-").map(Number);
  return Array.from({ length: quantidade }, (_, i) => {
    // UTC de propósito: aritmética de calendário, não de relógio — some dias
    // sem que horário de verão empurre a data para o dia anterior.
    const d = new Date(Date.UTC(ano, mes - 1, dia + i));
    return d.toISOString().slice(0, 10);
  });
}

const diasCurtos = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Rótulo do seletor de dia: "Hoje", "Amanhã" ou "qua · 01/10". */
export function rotuloDoDia(data: string, agora: Date = new Date()): string {
  const dias = proximosDias(2, agora);
  if (data === dias[0]) return "Hoje";
  if (data === dias[1]) return "Amanhã";

  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return `${diasCurtos[d.getUTCDay()]} · ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/** Data por extenso para o cabeçalho da grade: "quarta-feira, 1 de outubro". */
export function dataPorExtenso(data: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, dia)));
}
