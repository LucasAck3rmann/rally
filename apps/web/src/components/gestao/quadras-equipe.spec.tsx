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

function montarQuadras(
  quadras: QuadraDaGestao[],
  podeEditar = false,
) {
  render(
    <QuadrasDaArena
      quadras={quadras}
      estabelecimentoId="e1"
      podeEditar={podeEditar}
    />,
  );
}

describe("Quadras da arena", () => {
  it("conta as quadras e as pausadas no subtítulo", () => {
    montarQuadras([quadra(), quadra({ id: "q2", nome: "Quadra 2", ativo: false })]);

    expect(screen.getByText("2 quadras · 1 pausada")).toBeInTheDocument();
  });

  it("marca quem está na vitrine e quem está pausada", () => {
    montarQuadras([quadra(), quadra({ id: "q2", nome: "Quadra 2", ativo: false })]);

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
    montarQuadras([
      quadra({
        faixasPreco: [
          {
            id: "f1",
            diaSemana: null,
            horaInicio: "18:00",
            horaFim: "22:00",
            precoHora: 120,
          },
        ],
      }),
    ]);

    expect(screen.getByText(/todos os dias · 18:00–22:00/i)).toBeInTheDocument();
    expect(screen.queryByText(/domingo/i)).not.toBeInTheDocument();
  });

  it("diz que editar é pelo aplicativo em vez de deixar procurar botão", () => {
    montarQuadras([quadra()]);
    expect(screen.getByText(/é pelo aplicativo/i)).toBeInTheDocument();
  });

  it("sem quadra, explica o que fazer", () => {
    montarQuadras([]);
    expect(screen.getByText(/nenhuma quadra cadastrada/i)).toBeInTheDocument();
  });

  it("quem não é administrador não vê como pausar", () => {
    // A API recusa com 403; oferecer um botão que vai dar erro é pior que
    // não oferecer.
    montarQuadras([quadra()], false);
    expect(screen.queryByRole("button", { name: /pausar/i })).not.toBeInTheDocument();
  });

  it("o administrador pausa a que está na vitrine e reativa a pausada", () => {
    montarQuadras(
      [quadra(), quadra({ id: "q2", nome: "Quadra 2", ativo: false })],
      true,
    );

    const naVitrine = screen.getByRole("heading", { name: "Quadra 1" }).closest("li")!;
    const pausada = screen.getByRole("heading", { name: "Quadra 2" }).closest("li")!;
    expect(within(naVitrine).getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(within(pausada).getByRole("button", { name: "Reativar" })).toBeInTheDocument();
  });
});

function montarEquipe(equipe: MembroDaEquipe[], podeEditar = false) {
  render(
    <EquipeDaArena
      equipe={equipe}
      estabelecimentoId="e1"
      podeEditar={podeEditar}
    />,
  );
}

describe("Equipe da arena", () => {
  it("mostra nome, e-mail, papel e desde quando", () => {
    montarEquipe([membro()]);

    expect(screen.getByText("Augusto Boff")).toBeInTheDocument();
    expect(screen.getByText("augusto@rally.com.br")).toBeInTheDocument();
    expect(screen.getByText("Atendente")).toBeInTheDocument();
    expect(screen.getByText(/desde set\.? de 2026/i)).toBeInTheDocument();
  });

  it("avisa quando há um único administrador", () => {
    // Previne o engano antes de ele acontecer: rebaixar o único admin
    // tranca a arena, e a tela que consertaria exige ser admin.
    montarEquipe([membro({ papel: "ADMIN" })]);

    expect(screen.getByText(/único administrador/i)).toBeInTheDocument();
  });

  it("com dois administradores, não avisa nada", () => {
    montarEquipe([
      membro({ papel: "ADMIN" }),
      membro({ usuarioId: "u3", nome: "Lucas Ackermann", papel: "ADMIN" }),
    ]);

    expect(screen.queryByText(/único administrador/i)).not.toBeInTheDocument();
  });

  it("as iniciais ficam fora do leitor de tela", () => {
    // "AB" ao lado de "Augusto Boff" seria repetição sem informação.
    montarEquipe([membro()]);

    const linha = screen.getByText("Augusto Boff").closest("li")!;
    expect(within(linha).getByText("AB")).toHaveAttribute("aria-hidden", "true");
  });

  it("sem equipe, explica o que fazer", () => {
    montarEquipe([]);
    expect(screen.getByText(/só você por aqui/i)).toBeInTheDocument();
  });

  it("quem não é administrador vê o papel como texto, sem poder mudar", () => {
    // Ver a equipe é de toda a equipe; mexer é do admin.
    montarEquipe([membro()], false);

    expect(screen.getByText("Atendente")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tirar" })).not.toBeInTheDocument();
  });

  it("o administrador troca papel por um select, não por botões", () => {
    // Os papéis são exclusivos; um select diz isso sozinho, e com botões o
    // usuário precisa inferir que escolher um desfaz o outro.
    montarEquipe([membro()], true);

    const seletor = screen.getByRole("combobox", { name: /papel de augusto boff/i });
    expect(seletor).toHaveValue("ATENDENTE");
    expect(screen.getByRole("button", { name: "Tirar" })).toBeInTheDocument();
  });

  it("o último administrador não pode ser rebaixado pelo select", () => {
    // A API recusa com 403; desabilitar a opção explica antes do toque.
    montarEquipe([membro({ papel: "ADMIN" })], true);

    const seletor = screen.getByRole("combobox", { name: /papel de augusto boff/i });
    const atendente = within(seletor).getByRole("option", { name: "Atendente" });
    expect(atendente).toBeDisabled();
    expect(within(seletor).getByRole("option", { name: "Administrador" })).toBeEnabled();
  });

  it("o administrador tem por onde adicionar alguém", () => {
    montarEquipe([membro({ papel: "ADMIN" }), membro({ usuarioId: "u3" })], true);

    expect(screen.getByRole("heading", { name: /adicionar à equipe/i })).toBeInTheDocument();
    expect(screen.getByText(/precisa já ter conta no rally/i)).toBeInTheDocument();
  });
});
