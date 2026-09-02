// SPDX-License-Identifier: AGPL-3.0-or-later
import { deMinutos, diaDaSemana, emMinutos, horaLocalParaUtc, rotuloHoraLocal } from "./timezone";

const SP = "America/Sao_Paulo";

describe("timezone", () => {
  it("converte hora local do estabelecimento para o instante UTC", () => {
    // O Brasil não usa mais horário de verão: São Paulo é UTC-3 o ano todo.
    expect(horaLocalParaUtc("2026-06-16", "19:00", SP).toISOString()).toBe(
      "2026-06-16T22:00:00.000Z",
    );
    expect(horaLocalParaUtc("2026-01-15", "08:00", SP).toISOString()).toBe(
      "2026-01-15T11:00:00.000Z",
    );
  });

  it("volta o rótulo na hora local a partir do instante UTC", () => {
    const instante = new Date("2026-06-16T22:00:00.000Z");
    expect(rotuloHoraLocal(instante, SP)).toBe("19:00");
  });

  it("faz a viagem de ida e volta em qualquer fuso", () => {
    for (const fuso of [SP, "America/Manaus", "UTC", "Europe/Lisbon"]) {
      const instante = horaLocalParaUtc("2026-06-16", "07:30", fuso);
      expect(rotuloHoraLocal(instante, fuso)).toBe("07:30");
    }
  });

  it("acerta a hora de parede na virada de horário de verão", () => {
    // Lisboa entra no horário de verão em 29/03/2026 às 01:00.
    const antes = horaLocalParaUtc("2026-03-28", "12:00", "Europe/Lisbon");
    const depois = horaLocalParaUtc("2026-03-30", "12:00", "Europe/Lisbon");
    expect(antes.toISOString()).toBe("2026-03-28T12:00:00.000Z");
    expect(depois.toISOString()).toBe("2026-03-30T11:00:00.000Z");
  });

  it("resolve o dia da semana da data-calendário", () => {
    expect(diaDaSemana("2026-06-16")).toBe(2); // terça
    expect(diaDaSemana("2026-06-14")).toBe(0); // domingo
  });

  it("converte entre 'HH:mm' e minutos", () => {
    expect(emMinutos("19:30")).toBe(1170);
    expect(deMinutos(1170)).toBe("19:30");
    expect(deMinutos(480)).toBe("08:00");
  });
});
