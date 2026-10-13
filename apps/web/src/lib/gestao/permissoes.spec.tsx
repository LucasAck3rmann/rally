// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { Papel } from "./contratos";
import { podeAdministrar } from "./permissoes";

describe("podeAdministrar", () => {
  it("só o admin da arena escreve", () => {
    expect(podeAdministrar("ADMIN")).toBe(true);
  });

  it("mantenedor da plataforma não administra arena", () => {
    // É o defeito que esta função existe para fechar. O `PAPEIS_DE_GESTAO`
    // da API não inclui MANTENEDOR — ele é papel de nível SaaS — e o
    // `PapelGuard` o recusa em toda rota de arena. Quatro páginas liberavam
    // os botões para ele, e ele levaria 403 ao clicar.
    expect(podeAdministrar("MANTENEDOR")).toBe(false);
  });

  it("atendente e financeiro leem, mas não escrevem", () => {
    expect(podeAdministrar("ATENDENTE")).toBe(false);
    expect(podeAdministrar("FINANCEIRO")).toBe(false);
  });

  it("sem vínculo, não administra nada", () => {
    expect(podeAdministrar(null)).toBe(false);
  });

  it("cobre todos os papéis que o contrato admite", () => {
    // Se um papel novo entrar no enum, este teste falha e obriga a decidir
    // de que lado ele cai — em vez de cair no `false` por omissão.
    const papeis = Papel.options;
    expect(papeis).toEqual(["ATENDENTE", "FINANCEIRO", "ADMIN", "MANTENEDOR"]);
    expect(papeis.filter(podeAdministrar)).toEqual(["ADMIN"]);
  });
});
