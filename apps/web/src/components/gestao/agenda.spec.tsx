// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AgendaDoDia, ItemDaAgenda } from "@/lib/gestao/contratos";
import { AgendaDaArena } from "./agenda";

function item(opcoes: Partial<ItemDaAgenda> & { hora?: number; horas?: number } = {}) {
  const hora = opcoes.hora ?? 19;
  const horas = opcoes.horas ?? 1;
  const base = `2026-10-05T${String(hora).padStart(2, "0")}:00:00.000Z`;
  return {
    id: "a1",
    quadraId: "q1",
    quadraNome: "Quadra 1",
    inicio: base,
    fim: new Date(new Date(base).getTime() + horas * 3_600_000).toISOString(),
    horaInicio: `${String(hora).padStart(2, "0")}:00`,
    horaFim: `${String(hora + horas).padStart(2, "0")}:00`,
    status: "CONFIRMADA",
    origem: "APP",
    ehBloqueio: false,
    preco: 80,
    motivo: null,
    cliente: { id: "u1", nome: "Augusto Boff", telefone: null },
    ...opcoes,
  } satisfies ItemDaAgenda;
}

function montar(
  itens: ItemDaAgenda[] = [],
  quadras = [{ id: "q1", nome: "Quadra 1" }],
  podeBloquear = false,
) {
  const agenda: AgendaDoDia = {
    data: "2026-10-05",
    timezone: "America/Sao_Paulo",
    quadras,
    itens,
  };
  render(
    <AgendaDaArena
      agenda={agenda}
      dias={["2026-10-05", "2026-10-06"]}
      estabelecimentoId="e1"
      podeBloquear={podeBloquear}
    />,
  );
}

describe("Agenda da arena", () => {
  it("desenha hora nas linhas e quadra nas colunas", () => {
    // A agenda **é** uma matriz; a tabela faz o leitor de tela anunciar
    // linha e coluna de graça, o que uma grade de `div` não faz.
    montar([], [
      { id: "q1", nome: "Quadra 1" },
      { id: "q2", nome: "Quadra 2" },
    ]);

    expect(screen.getByRole("columnheader", { name: "Quadra 1" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Quadra 2" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "08h" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "22h" })).toBeInTheDocument();
  });

  it("a faixa de horas cresce para caber o jogo fora dela", () => {
    // Cortar em 22h esconderia da agenda o horário mais disputado do verão.
    montar([item({ hora: 23 })]);
    expect(screen.getByRole("rowheader", { name: "23h" })).toBeInTheDocument();
  });

  it("mostra o cliente e o preço na reserva", () => {
    montar([item()]);

    expect(screen.getByText("Augusto Boff")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?80,00/)).toBeInTheDocument();
  });

  it("bloqueio mostra o motivo e não mostra preço", () => {
    // Não há cobrança nem pessoa: "R$ 0,00" e um nome em branco seriam duas
    // mentiras diferentes.
    montar([
      item({
        id: "b1",
        ehBloqueio: true,
        preco: null,
        cliente: null,
        motivo: "Manutenção da rede",
      }),
    ]);

    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    expect(screen.getByText("Manutenção da rede")).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("reserva de duas horas não repete o card na segunda linha", () => {
    montar([item({ horas: 2 })]);

    expect(screen.getAllByText("Augusto Boff")).toHaveLength(1);
    expect(screen.getByText("Continuação de 19:00")).toBeInTheDocument();
  });

  it("horário livre é anunciado para quem não vê a grade", () => {
    // Uma matriz de células mudas é intransitável no leitor de tela.
    montar([]);
    expect(screen.getByText("19h livre")).toBeInTheDocument();
  });

  it("o dia vai na URL, para o link ser compartilhável", () => {
    montar([]);

    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAttribute(
      "href",
      "/gestao/e1/agenda?data=2026-10-05",
    );
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("sem quadra ativa, explica o que fazer", () => {
    montar([], []);

    expect(screen.getByText(/nenhuma quadra ativa/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("quem não é administrador não vê como bloquear", () => {
    // A API recusa com 403; oferecer o que vai dar erro é pior que não
    // oferecer. A grade continua legível — o atendente vê o dia.
    montar([], [{ id: "q1", nome: "Quadra 1" }], false);
    expect(screen.queryByRole("button", { name: "Bloquear" })).not.toBeInTheDocument();
    expect(screen.getByText("19h livre")).toBeInTheDocument();
  });

  it("o administrador bloqueia o horário livre", () => {
    montar([], [{ id: "q1", nome: "Quadra 1" }], true);

    // Uma por hora da faixa — 8h a 22h são quinze.
    expect(screen.getAllByRole("button", { name: "Bloquear" })).toHaveLength(15);
  });

  it("o administrador libera o que está bloqueado, e não a reserva", () => {
    montar(
      [
        item({ hora: 19, id: "b1", ehBloqueio: true, preco: null, cliente: null }),
        item({ hora: 20, id: "r1" }),
      ],
      [{ id: "q1", nome: "Quadra 1" }],
      true,
    );

    const bloqueada = screen.getByRole("rowheader", { name: "19h" }).closest("tr")!;
    const reservada = screen.getByRole("rowheader", { name: "20h" }).closest("tr")!;
    expect(within(bloqueada).getByRole("button", { name: "Liberar" })).toBeInTheDocument();
    // Reserva de cliente não tem botão: quem pagou perde o horário pelo
    // cancelamento, que cobra motivo e avisa.
    expect(within(reservada).queryByRole("button")).not.toBeInTheDocument();
  });

  it("a célula ocupada fica na linha da hora certa", () => {
    montar([item({ hora: 20 })]);

    const linha = screen.getByRole("rowheader", { name: "20h" }).closest("tr")!;
    expect(within(linha).getByText("Augusto Boff")).toBeInTheDocument();
  });
});
