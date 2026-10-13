// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Relatorio } from "@/lib/gestao/contratos";
import { RelatorioDaArena } from "./relatorio";

const BASE: Relatorio = {
  estabelecimento: { nome: "Arena Beach Sapiranga", timezone: "America/Sao_Paulo" },
  periodo: { de: "2026-09-10", ate: "2026-09-12", dias: 3 },
  resumo: {
    receitaPaga: 800,
    receitaAReceber: 240,
    receitaTotal: 1040,
    ticketMedio: 130,
    ocupacao: 42.5,
    horasVendidas: 8,
    horasDisponiveis: 42,
    vendidas: 8,
    canceladas: 1,
  },
  porMetodo: [
    { metodo: "Pix", reservas: 6, valor: 800, participacao: 76.9 },
    { metodo: "Balcão", reservas: 2, valor: 240, participacao: 23.1 },
  ],
  porDia: [
    { data: "2026-09-10", reservas: 4, receita: 640, horas: 4, ocupacao: 28.6 },
    { data: "2026-09-11", reservas: 0, receita: 0, horas: 0, ocupacao: 0 },
    { data: "2026-09-12", reservas: 4, receita: 400, horas: 4, ocupacao: 28.6 },
  ],
  porQuadra: [
    { quadraId: "q1", nome: "Quadra 1", reservas: 6, horas: 6, receita: 640 },
  ],
};

function montar(parcial: Partial<Relatorio> = {}) {
  render(
    <RelatorioDaArena
      relatorio={{ ...BASE, ...parcial }}
      estabelecimentoId="e1"
      urlDoCsv="/gestao/e1/relatorios/csv?de=2026-09-10&ate=2026-09-12"
      urlDoXlsx="/gestao/e1/relatorios/xlsx?de=2026-09-10&ate=2026-09-12"
      urlDoPdf="/gestao/e1/relatorios/pdf?de=2026-09-10&ate=2026-09-12"
    />,
  );
}

describe("Relatório da arena", () => {
  it("mostra o período em formato brasileiro", () => {
    montar();
    expect(screen.getByText(/10\/09\/2026 a 12\/09\/2026 · 3 dias/)).toBeInTheDocument();
  });

  it("os três downloads levam o período na URL e pedem para salvar", () => {
    // Sem `download`, o navegador tenta exibir o arquivo em vez de salvar —
    // e com o PDF ele exibiria mesmo, que é o caminho mais longo até o
    // arquivo salvo.
    montar();

    const excel = screen.getByRole("link", { name: /baixar excel/i });
    expect(excel).toHaveAttribute(
      "href",
      "/gestao/e1/relatorios/xlsx?de=2026-09-10&ate=2026-09-12",
    );
    expect(excel).toHaveAttribute("download");

    const pdf = screen.getByRole("link", { name: "PDF" });
    expect(pdf).toHaveAttribute(
      "href",
      "/gestao/e1/relatorios/pdf?de=2026-09-10&ate=2026-09-12",
    );
    expect(pdf).toHaveAttribute("download");

    const csv = screen.getByRole("link", { name: "CSV" });
    expect(csv).toHaveAttribute(
      "href",
      "/gestao/e1/relatorios/csv?de=2026-09-10&ate=2026-09-12",
    );
    expect(csv).toHaveAttribute("download");
  });

  it("separa recebido de a receber", () => {
    // Juntar faria um Pix pendente parecer dinheiro em caixa. Escopado aos
    // cards: os mesmos valores reaparecem na quebra por método.
    montar();

    const recebido = screen.getByText("Recebido").closest("div")!;
    const aReceber = screen.getByText("A receber").closest("div")!;
    expect(within(recebido).getByText(/R\$\s?800,00/)).toBeInTheDocument();
    expect(within(aReceber).getByText(/R\$\s?240,00/)).toBeInTheDocument();
  });

  it("sem denominador, a ocupação é um traço e explica por quê", () => {
    montar({
      resumo: { ...BASE.resumo, ocupacao: null, horasDisponiveis: 0 },
    });

    expect(screen.getByText(/sem horário cadastrado/i)).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("mostra a quebra por método com a participação", () => {
    montar();

    const pix = screen.getByText("Pix").closest("tr")!;
    expect(within(pix).getByText("76,9%")).toBeInTheDocument();
    // Venda de balcão aparece como método: sem ela a soma não fecharia com
    // a receita total.
    expect(screen.getByText("Balcão")).toBeInTheDocument();
  });

  it("o dia sem movimento aparece na série, zerado", () => {
    // Um gráfico que pula a quarta vazia mente sobre a forma da semana.
    montar();

    expect(screen.getByText("11/09")).toBeInTheDocument();
    const vazio = screen.getByText("11/09").closest("li")!;
    expect(within(vazio).getByText("—")).toBeInTheDocument();
  });

  it("a barra do dia é decorativa para o leitor de tela", () => {
    // O número ao lado já diz o valor; a barra repetiria sem informar.
    montar();

    const dia = screen.getByText("10/09").closest("li")!;
    const barra = dia.querySelector("[aria-hidden='true']");
    expect(barra).not.toBeNull();
  });

  it("diz para que serve cada um dos três formatos", () => {
    // O RF-28 pede CSV, XLSX e PDF, e os três existem. Eles não são o mesmo
    // arquivo em embalagens diferentes: sem dizer para que serve cada um, a
    // escolha vira sorteio e o dono baixa o errado.
    montar();

    expect(screen.getByText(/soma e gera gráfico sem converter nada/i)).toBeInTheDocument();
    expect(screen.getByText(/para ler e enviar/i)).toBeInTheDocument();
    expect(screen.getByText(/importar em outro sistema/i)).toBeInTheDocument();
  });

  it("sem venda, a tabela de métodos explica o vazio", () => {
    montar({ porMetodo: [] });
    expect(screen.getByText(/nenhuma venda no período/i)).toBeInTheDocument();
  });
});
