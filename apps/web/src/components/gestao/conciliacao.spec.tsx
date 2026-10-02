// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Conciliacao } from "@/lib/gestao/contratos";
import { ConciliacaoDaArena } from "./conciliacao";

type Divergencia = Conciliacao["divergencias"][number];

function divergencia(opcoes: Partial<Divergencia> = {}): Divergencia {
  return {
    tipo: "PENDENTE_EXPIRADA",
    descricao: "Pix expirou e a reserva continua ocupando o horário.",
    gravidade: "grave",
    reservaId: "r1",
    codigo: "RALLY-7K2P",
    quadra: "Quadra 1",
    cliente: "Augusto Boff",
    inicio: "2026-10-05T22:00:00.000Z",
    statusReserva: "PENDENTE_PAGAMENTO",
    statusPagamento: "PENDENTE",
    valorReserva: 80,
    valorPagamento: 80,
    ...opcoes,
  };
}

function montar(
  parcial: Partial<Conciliacao> = {},
  podeExpirar = true,
) {
  const divergencias = parcial.divergencias ?? [divergencia()];
  render(
    <ConciliacaoDaArena
      conciliacao={{
        conferidas: parcial.conferidas ?? 12,
        graves:
          parcial.graves ??
          divergencias.filter((d) => d.gravidade === "grave").length,
        divergencias,
        porTipo:
          parcial.porTipo ?? [
            {
              tipo: "PENDENTE_EXPIRADA",
              quantidade: 1,
              descricao: "Pix expirou e a reserva continua ocupando o horário.",
              gravidade: "grave",
            },
          ],
      }}
      estabelecimentoId="e1"
      podeExpirar={podeExpirar}
    />,
  );
}

describe("Conciliação da arena", () => {
  it("mostra o denominador junto do número de divergências", () => {
    // Sem as conferidas, ninguém sabe se 1 divergência é muito ou pouco.
    montar();
    expect(
      screen.getByText(/12 reservas conferidas · 1 divergência · 1 grave/),
    ).toBeInTheDocument();
  });

  it("tudo fechando explica o vazio em vez de mostrar tabela vazia", () => {
    montar({ divergencias: [], porTipo: [], graves: 0 });

    expect(screen.getByText(/nada a resolver/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("oferece liberar os horários presos por Pix expirado", () => {
    montar();

    expect(screen.getByText(/1 horário preso por pix expirado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /liberar horários/i })).toBeInTheDocument();
  });

  it("diz o que acontece ao liberar, em vez de só perguntar", () => {
    // "Tem certeza?" não informa; o texto diz que a reserva vira cancelada
    // e o histórico fica.
    montar();
    expect(
      screen.getByText(/marca as reservas como canceladas. O histórico fica./i),
    ).toBeInTheDocument();
  });

  it("quem não é administrador não vê o botão de liberar", () => {
    // Liberar escreve na agenda; a API recusa com 403.
    montar({}, false);

    expect(screen.queryByRole("button", { name: /liberar horários/i })).not.toBeInTheDocument();
    // A divergência continua visível: o financeiro precisa saber que existe.
    expect(screen.getByText("RALLY-7K2P")).toBeInTheDocument();
  });

  it("sem horário preso, não oferece liberar nada", () => {
    montar({
      divergencias: [
        divergencia({
          tipo: "CANCELADA_PAGA",
          descricao: "Reserva cancelada com pagamento confirmado — estorno devido.",
          statusReserva: "CANCELADA",
          statusPagamento: "PAGO",
        }),
      ],
      porTipo: [],
    });

    expect(screen.queryByRole("button", { name: /liberar horários/i })).not.toBeInTheDocument();
  });

  it("destaca o valor da cobrança quando difere do da reserva", () => {
    montar({
      divergencias: [
        divergencia({
          tipo: "VALOR_DIVERGENTE",
          descricao: "Valor cobrado diferente do preço da reserva.",
          valorReserva: 80,
          valorPagamento: 120,
        }),
      ],
    });

    const linha = screen.getByText("RALLY-7K2P").closest("tr")!;
    expect(within(linha).getByText(/R\$\s?120,00/)).toBeInTheDocument();
  });

  it("não repete o valor quando reserva e cobrança batem", () => {
    // Mostrar "R$ 80,00 / R$ 80,00" só gasta a atenção de quem lê.
    montar();

    const linha = screen.getByText("RALLY-7K2P").closest("tr")!;
    expect(within(linha).getAllByText(/R\$\s?80,00/)).toHaveLength(1);
  });

  it("reserva sem cliente aparece como Balcão", () => {
    montar({ divergencias: [divergencia({ cliente: null })] });

    const linha = screen.getByText("RALLY-7K2P").closest("tr")!;
    expect(within(linha).getByText(/Balcão · Quadra 1/)).toBeInTheDocument();
  });

  it("declara que não compara com o extrato do gateway", () => {
    // Sem credencial da AbacatePay não há extrato (ADR-0013); dizer isso
    // evita que a tela prometa conciliação bancária.
    montar();
    expect(screen.getByText(/depende das credenciais da AbacatePay/i)).toBeInTheDocument();
  });
});
