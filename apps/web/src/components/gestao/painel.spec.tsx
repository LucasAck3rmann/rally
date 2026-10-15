// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Painel } from "@/lib/gestao/contratos";
import { PainelDaArena } from "./painel";

const BASE: Painel = {
  periodo: { de: "2026-09-24", ate: "2026-09-30", dias: 7 },
  receita: { paga: 800, aReceber: 240, total: 1040, ticketMedio: 130 },
  ocupacao: { percentual: 42.5, horasVendidas: 8, horasDisponiveis: 98 },
  reservas: { vendidas: 8, canceladas: 1, bloqueios: 2, taxaCancelamento: 11.1 },
  porQuadra: [
    {
      quadraId: "q1",
      nome: "Quadra 1",
      reservas: 6,
      horasVendidas: 6,
      receita: 640,
      ocupacao: 40,
    },
  ],
  proximosJogos: [
    {
      id: "j1",
      quadraNome: "Quadra 1",
      clienteNome: "Augusto Boff",
      inicio: "2026-10-01T22:00:00.000Z",
      horaInicio: "19:00",
      horaFim: "20:00",
      preco: 80,
      status: "CONFIRMADA",
      pago: true,
    },
  ],
};

function montar(painel: Partial<Painel> = {}) {
  render(
    <PainelDaArena
      painel={{ ...BASE, ...painel }}
      dias={7}
      periodos={[7, 30, 90]}
      estabelecimentoId="e1"
    />,
  );
}

describe("Painel da arena", () => {
  it("separa o que entrou do que ainda pode não entrar", () => {
    // Juntar caixa e a receber num número só faria um Pix pendente parecer
    // dinheiro que já entrou — e Pix pendente expira.
    montar();

    expect(screen.getByText(/recebido no período/i)).toBeInTheDocument();
    // A web mostra centavos sempre (`Intl` em BRL); o app omite quando o
    // valor é redondo. Divergência conhecida entre as duas superfícies —
    // num painel financeiro os centavos ajudam, num card de preço atrapalham.
    expect(screen.getByText(/R\$\s?800,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?240,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?130,00/)).toBeInTheDocument();
  });

  it("sem venda, o ticket médio é um traço e não zero", () => {
    // "R$ 0,00" diria "o ticket é zero reais"; o traço diz "não há o que
    // medir". A asserção é escopada ao par certo porque `paga` e `aReceber`
    // também são zero aqui.
    montar({
      receita: { paga: 0, aReceber: 0, total: 0, ticketMedio: null },
    });

    const par = screen.getByText(/ticket médio/i).closest("div")!;
    expect(within(par).getByText("—")).toBeInTheDocument();
  });

  it("sem horário cadastrado, a ocupação é um traço e não 0%", () => {
    // "0%" afirmaria que a arena está vazia; o que não há é denominador.
    montar({
      ocupacao: { percentual: null, horasVendidas: 8, horasDisponiveis: 0 },
    });

    expect(screen.getByText(/sem horário cadastrado/i)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("o período atual é marcado para o leitor de tela", () => {
    montar();

    const atual = screen.getByRole("link", { name: "7 dias" });
    expect(atual).toHaveAttribute("aria-current", "page");
    // Os outros não: `aria-current` em todos equivaleria a em nenhum.
    expect(screen.getByRole("link", { name: "30 dias" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("o período vai na URL, para o link ser compartilhável", () => {
    montar();

    expect(screen.getByRole("link", { name: "30 dias" })).toHaveAttribute(
      "href",
      "/gestao/e1?dias=30",
    );
  });

  it("quadra parada aparece em vez de sumir", () => {
    // É justamente a quadra sem reserva que o dono precisa enxergar.
    montar({
      porQuadra: [
        ...BASE.porQuadra,
        {
          quadraId: "q9",
          nome: "Quadra do Fundo",
          reservas: 0,
          horasVendidas: 0,
          receita: 0,
          ocupacao: 0,
        },
      ],
    });

    const linha = screen.getByText("Quadra do Fundo").closest("li")!;
    expect(within(linha).getByText(/nenhuma reserva no período/i)).toBeInTheDocument();
  });

  it("reserva sem cliente é de balcão, não um nome em branco", () => {
    montar({
      proximosJogos: [{ ...BASE.proximosJogos[0], clienteNome: null, pago: false }],
    });

    expect(screen.getByText("Reserva de balcão")).toBeInTheDocument();
    expect(screen.getByText(/a pagar/i)).toBeInTheDocument();
  });

  it("período sem movimento explica o vazio em vez de mostrar zeros", () => {
    montar({
      receita: { paga: 0, aReceber: 0, total: 0, ticketMedio: null },
      reservas: { vendidas: 0, canceladas: 0, bloqueios: 0, taxaCancelamento: null },
      porQuadra: [],
      proximosJogos: [],
    });

    expect(screen.getByText(/nenhum movimento no período/i)).toBeInTheDocument();
    expect(screen.queryByText(/por quadra/i)).not.toBeInTheDocument();
  });
});
