// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CupomDaGestao } from "@/lib/gestao/contratos";
import { CuponsDaArena } from "./cupons";

function cupom(parcial: Partial<CupomDaGestao> = {}): CupomDaGestao {
  return {
    id: "c1",
    codigo: "BORAJOGAR",
    tipo: "PERCENTUAL",
    valor: 20,
    validadeInicio: "2026-10-01T00:00:00.000Z",
    validadeFim: "2026-11-30T23:59:59.000Z",
    usosMax: 200,
    usosFeitos: 3,
    ativo: true,
    vigente: true,
    esgotado: false,
    vencido: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...parcial,
  };
}

function montar(cupons: CupomDaGestao[] = [cupom()], podeEditar = true) {
  render(<CuponsDaArena cupons={cupons} estabelecimentoId="e1" podeEditar={podeEditar} />);
}

describe("Cupons da arena", () => {
  it("mostra código, desconto e janela de validade", () => {
    montar();

    expect(screen.getByText("BORAJOGAR")).toBeInTheDocument();
    expect(screen.getByText(/20% · 01\/10\/2026 a 30\/11\/2026/)).toBeInTheDocument();
  });

  it("valor fixo aparece como dinheiro, e não como porcentagem", () => {
    montar([cupom({ tipo: "VALOR_FIXO", valor: 25 })]);
    expect(screen.getByText(/R\$\s?25,00/)).toBeInTheDocument();
  });

  it("distingue desligado, vencido e esgotado", () => {
    // Os três parecem a mesma coisa numa lista que só diz "inativo", e
    // levam a ações diferentes: religar, estender a validade, aumentar o
    // teto.
    montar([
      cupom({ id: "a", codigo: "DESLIGADO", ativo: false, vigente: false }),
      cupom({ id: "b", codigo: "VENCIDO", vigente: false, vencido: true }),
      cupom({
        id: "c",
        codigo: "ESGOTADO",
        vigente: false,
        esgotado: true,
        usosMax: 10,
        usosFeitos: 10,
      }),
    ]);

    const linha = (codigo: string) => screen.getByText(codigo).closest("li")!;
    expect(within(linha("DESLIGADO")).getByText("Desligado")).toBeInTheDocument();
    expect(within(linha("VENCIDO")).getByText("Vencido")).toBeInTheDocument();
    expect(within(linha("ESGOTADO")).getByText("Esgotado")).toBeInTheDocument();
  });

  it("cupom sem teto mostra quantas vezes rodou, e não '3 de ∞'", () => {
    montar([cupom({ usosMax: null, usosFeitos: 3 })]);
    expect(screen.getByText("3 usos")).toBeInTheDocument();
  });

  it("com teto, mostra o quanto já foi usado do total", () => {
    montar([cupom({ usosMax: 200, usosFeitos: 3 })]);
    expect(screen.getByText("3 de 200")).toBeInTheDocument();
  });

  it("quem não é admin vê a lista, mas não os botões de escrita", () => {
    // A autorização é do servidor; isto só evita entregar um 403 no lugar de
    // uma tela honesta.
    montar([cupom()], false);

    expect(screen.getByText("BORAJOGAR")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /desligar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar cupom/i })).not.toBeInTheDocument();
  });

  it("o botão acompanha o estado: desligar quando ligado, religar quando não", () => {
    montar([
      cupom({ id: "a", codigo: "LIGADO", ativo: true }),
      cupom({ id: "b", codigo: "APAGADO", ativo: false, vigente: false }),
    ]);

    const linha = (codigo: string) => screen.getByText(codigo).closest("li")!;
    expect(within(linha("LIGADO")).getByRole("button", { name: "Desligar" })).toBeInTheDocument();
    expect(within(linha("APAGADO")).getByRole("button", { name: "Religar" })).toBeInTheDocument();
  });

  it("sem cupom nenhum, sugere o primeiro em vez de mostrar vazio", () => {
    montar([]);
    expect(screen.getByText(/vazio no meio da semana/i)).toBeInTheDocument();
  });

  it("diz que cupom não se apaga, e por quê", () => {
    // É a decisão de modelagem: o cupom é a origem do desconto de reservas
    // pagas, e apagá-lo deixaria um preço sem explicação no relatório.
    montar();
    expect(screen.getByText(/não se apaga, se desliga/i)).toBeInTheDocument();
  });

  it("explica que cupom não soma com o desconto do Pix", () => {
    // Sem isso o dono cria um cupom de 5% numa arena com 10% no Pix e acha
    // que está dando 15%.
    montar();
    expect(screen.getByText(/vale o maior dos dois/i)).toBeInTheDocument();
  });
});
