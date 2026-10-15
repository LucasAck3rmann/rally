// SPDX-License-Identifier: AGPL-3.0-or-later
import { LIMITES } from "./limites";

/** Janela em minutos e teto de cada balde, por nome. */
function balde(nome: string) {
  const achado = LIMITES.throttlers.find((t) => t.name === nome);
  if (!achado) throw new Error(`balde "${nome}" não existe`);
  return {
    minutos: Number(achado.ttl) / 60_000,
    limite: Number(achado.limit),
  };
}

describe("limites de tentativa nas rotas de autenticação (RNF-06)", () => {
  it("existe um balde para cada risco, com nome próprio", () => {
    expect(LIMITES.throttlers.map((t) => t.name).sort()).toEqual([
      "cadastro",
      "login",
      "recuperacao",
      "token",
    ]);
  });

  it("a recuperação é o balde mais apertado por minuto", () => {
    // É o único que **manda e-mail para terceiro**: sem limite, a rota vira
    // amplificador e enche a caixa de entrada de qualquer pessoa com o Rally
    // como remetente. Afrouxar isto sem pensar é o erro que este teste pega.
    const porMinuto = (nome: string) => {
      const b = balde(nome);
      return b.limite / b.minutos;
    };

    expect(porMinuto("recuperacao")).toBeLessThan(porMinuto("login"));
    expect(porMinuto("recuperacao")).toBeLessThan(porMinuto("token"));
  });

  it("o login deixa o humano que errou tentar de novo", () => {
    // Apertado demais vira suporte: quem digitou a senha errada duas vezes
    // precisa conseguir a terceira.
    const { limite, minutos } = balde("login");
    expect(minutos).toBe(1);
    expect(limite).toBeGreaterThanOrEqual(5);
    expect(limite).toBeLessThanOrEqual(15);
  });

  it("o cadastro conta por hora, e não por minuto", () => {
    // Criar conta é raro por pessoa; a janela curta não distinguiria uso
    // normal de criação em massa.
    expect(balde("cadastro").minutos).toBe(60);
  });

  it("nenhum balde é frouxo a ponto de não existir", () => {
    for (const t of LIMITES.throttlers) {
      expect(Number(t.limit)).toBeGreaterThan(0);
      expect(Number(t.limit)).toBeLessThanOrEqual(100);
      expect(Number(t.ttl)).toBeGreaterThan(0);
    }
  });
});
