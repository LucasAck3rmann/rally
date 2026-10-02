// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MembroDaEquipe, QuadraDaGestao } from "@/lib/gestao/contratos";
import { EquipeDaArena } from "./equipe";
import { QuadrasDaArena } from "./quadras";

function quadra(opcoes: Partial<QuadraDaGestao> = {}): QuadraDaGestao {
  return {
    id: "q1",
    nome: "Quadra 1",
    descricao: null,
    precoHora: 80,
    capacidade: 4,
    fotos: [],
    comodidades: ["Vestiário"],
    modalidades: ["Beach Tennis"],
    faixasPreco: [],
    ativo: true,
    ...opcoes,
  };
}

function membro(opcoes: Partial<MembroDaEquipe> = {}): MembroDaEquipe {
  return {
    usuarioId: "u2",
    nome: "Augusto Boff",
    email: "augusto@rally.com.br",
    avatarUrl: null,
    papel: "ATENDENTE",
    desde: "2026-09-01T12:00:00.000Z",
    ...opcoes,
  };
}

describe("Quadras da arena", () => {
  it("conta as quadras e as pausadas no subtítulo", () => {
    render(
      <QuadrasDaArena
        quadras={[quadra(), quadra({ id: "q2", nome: "Quadra 2", ativo: false })]}
      />,
    );

    expect(screen.getByText("2 quadras · 1 pausada")).toBeInTheDocument();
  });

  it("marca quem está na vitrine e quem está pausada", () => {
    render(
      <QuadrasDaArena
        quadras={[quadra(), quadra({ id: "q2", nome: "Quadra 2", ativo: false })]}
      />,
    );

    // Escopado ao card: "pausada" também aparece no subtítulo com a
    // contagem, e uma busca solta casaria com os dois.
    const naVitrine = screen.getByRole("heading", { name: "Quadra 1" }).closest("li")!;
    const pausada = screen.getByRole("heading", { name: "Quadra 2" }).closest("li")!;
    expect(within(naVitrine).getByText(/na vitrine/i)).toBeInTheDocument();
    expect(within(pausada).getByText(/pausada/i)).toBeInTheDocument();
  });

  it("faixa sem dia vale para todos os dias, não para domingo", () => {
    // `null` em `diaSemana` quer dizer "todos os dias" e é o caso mais
    // comum; ler como 0 mostraria "Domingo" na faixa da semana inteira.
    render(
      <QuadrasDaArena
        quadras={[
          quadra({
            faixasPreco: [
              { id: "f1", diaSemana: null, horaInicio: "18:00", horaFim: "22:00", precoHora: 120 },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText(/todos os dias · 18:00–22:00/i)).toBeInTheDocument();
    expect(screen.queryByText(/domingo/i)).not.toBeInTheDocument();
  });

  it("diz que editar é pelo aplicativo em vez de deixar procurar botão", () => {
    render(<QuadrasDaArena quadras={[quadra()]} />);
    expect(screen.getByText(/é pelo aplicativo/i)).toBeInTheDocument();
  });

  it("sem quadra, explica o que fazer", () => {
    render(<QuadrasDaArena quadras={[]} />);
    expect(screen.getByText(/nenhuma quadra cadastrada/i)).toBeInTheDocument();
  });
});

describe("Equipe da arena", () => {
  it("mostra nome, e-mail, papel e desde quando", () => {
    render(<EquipeDaArena equipe={[membro()]} />);

    expect(screen.getByText("Augusto Boff")).toBeInTheDocument();
    expect(screen.getByText("augusto@rally.com.br")).toBeInTheDocument();
    expect(screen.getByText("Atendente")).toBeInTheDocument();
    expect(screen.getByText(/desde set\.? de 2026/i)).toBeInTheDocument();
  });

  it("avisa quando há um único administrador", () => {
    // Previne o engano antes de ele acontecer: rebaixar o único admin
    // tranca a arena, e a tela que consertaria exige ser admin.
    render(<EquipeDaArena equipe={[membro({ papel: "ADMIN" })]} />);

    expect(screen.getByText(/único administrador/i)).toBeInTheDocument();
  });

  it("com dois administradores, não avisa nada", () => {
    render(
      <EquipeDaArena
        equipe={[
          membro({ papel: "ADMIN" }),
          membro({ usuarioId: "u3", nome: "Lucas Ackermann", papel: "ADMIN" }),
        ]}
      />,
    );

    expect(screen.queryByText(/único administrador/i)).not.toBeInTheDocument();
  });

  it("as iniciais ficam fora do leitor de tela", () => {
    // "AB" ao lado de "Augusto Boff" seria repetição sem informação.
    render(<EquipeDaArena equipe={[membro()]} />);

    const linha = screen.getByText("Augusto Boff").closest("li")!;
    expect(within(linha).getByText("AB")).toHaveAttribute("aria-hidden", "true");
  });

  it("sem equipe, explica o que fazer", () => {
    render(<EquipeDaArena equipe={[]} />);
    expect(screen.getByText(/só você por aqui/i)).toBeInTheDocument();
  });
});
