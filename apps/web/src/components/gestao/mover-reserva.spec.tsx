// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { intervaloLocal } from "@/lib/formato";
import { MoverReserva } from "./mover-reserva";

const QUADRAS = [
  { id: "q1", nome: "Quadra 1" },
  { id: "q2", nome: "Quadra 2" },
  { id: "q3", nome: "Quadra 3" },
];
const HORAS = Array.from({ length: 15 }, (_, i) => 8 + i);

function montar(parcial: Partial<Parameters<typeof MoverReserva>[0]> = {}) {
  render(
    <MoverReserva
      estabelecimentoId="e1"
      reservaId="r1"
      data="2026-10-05"
      quadraAtual="q2"
      horaAtual={19}
      duracaoEmHoras={1}
      quadras={QUADRAS}
      horas={HORAS}
      {...parcial}
    />,
  );
}

/** Abre o formulário, que começa fechado para não ocupar a célula da grade. */
function abrir() {
  fireEvent.click(screen.getByRole("button", { name: "Mover" }));
}

describe("intervalo local da grade", () => {
  it("preserva a duração da reserva", () => {
    // Encurtar em silêncio devolveria para a venda uma hora que o cliente
    // já tinha comprado.
    const { inicio, fim } = intervaloLocal("2026-10-05", 19, 2);
    const horas = (new Date(fim).getTime() - new Date(inicio).getTime()) / 3_600_000;
    expect(horas).toBe(2);
  });

  it("mantém a hora local escolhida, qualquer que seja o fuso", () => {
    // Asserção sobre a hora **local** e não sobre o texto ISO: o teste roda
    // no fuso da máquina, e fixar o ISO quebraria fora do Brasil.
    const { inicio } = intervaloLocal("2026-10-05", 7, 1);
    expect(new Date(inicio).getHours()).toBe(7);
  });

  it("atravessa a meia-noite sem virar hora inexistente", () => {
    // Foi este caso que achou o defeito: formatar `hora + duração`
    // daria "25:00", `Date` inválido e `toISOString` estourando no
    // clique. A grade desenha a linha das 24h quando há reserva longa.
    const { inicio, fim } = intervaloLocal("2026-10-05", 23, 2);
    expect(new Date(inicio).getHours()).toBe(23);
    expect(new Date(fim).getDate()).toBe(6);
  });
});

describe("Mover reserva", () => {
  it("começa fechado, para não ocupar a célula da grade", () => {
    montar();
    expect(screen.getByRole("button", { name: "Mover" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Quadra")).not.toBeInTheDocument();
  });

  it("abre já apontando para onde a reserva está hoje", () => {
    // Pré-selecionar o estado atual é o que faz mudar só a hora custar um
    // clique — o caso comum é empurrar o jogo, não trocar tudo.
    montar();
    abrir();

    expect(screen.getByLabelText("Quadra")).toHaveValue("q2");
    expect(screen.getByLabelText("Hora")).toHaveValue("19");
  });

  it("oferece todas as quadras da arena, e não só a atual", () => {
    // É a diferença em relação à remarcação do cliente: quadra alagada se
    // resolve mudando de quadra, e o cliente não pode fazer isso.
    montar();
    abrir();

    const quadra = screen.getByLabelText("Quadra");
    expect(within(quadra).getAllByRole("option")).toHaveLength(3);
    expect(within(quadra).getByRole("option", { name: "Quadra 3" })).toBeInTheDocument();
  });

  it("fecha sem enviar quando o dono desiste", () => {
    montar();
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Quadra")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover" })).toBeInTheDocument();
  });

  it("os dois campos têm rótulo ligado, para o leitor de tela anunciar", () => {
    // `getByLabelText` acima já falharia sem o `htmlFor`; aqui a intenção
    // fica declarada, porque é requisito de acessibilidade e não detalhe.
    montar();
    abrir();

    expect(screen.getByLabelText("Quadra").tagName).toBe("SELECT");
    expect(screen.getByLabelText("Hora").tagName).toBe("SELECT");
  });
});
