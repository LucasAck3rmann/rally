// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { encerrarMensalista } from "@/lib/gestao/acoes";
import type { Mensalista } from "@/lib/gestao/contratos";
import { MensalistasDaArena } from "./mensalistas";

vi.mock("@/lib/gestao/acoes", () => ({
  encerrarMensalista: vi.fn(),
  materializarMensalista: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const HOJE = "2026-10-20";

function mensalista(opcoes: Partial<Mensalista> = {}): Mensalista {
  return {
    id: "s1",
    quadraId: "q1",
    quadra: "Quadra 1",
    clienteId: "u1",
    cliente: "Augusto Boff",
    diaSemana: 2,
    horaInicio: "19:00",
    duracaoMinutos: 60,
    vigenciaInicio: "2026-10-01",
    vigenciaFim: null,
    preco: 90,
    status: "ATIVA",
    materializadaAte: "2026-12-15",
    observacao: null,
    ...opcoes,
  };
}

function montar(lista: Mensalista[], podeEditar = true) {
  render(
    <MensalistasDaArena
      mensalistas={lista}
      estabelecimentoId="e1"
      hoje={HOJE}
      podeEditar={podeEditar}
    />,
  );
}

describe("MensalistasDaArena", () => {
  it("mostra o horário com o fim calculado pela duração", () => {
    // O horário é o que identifica o mensalista — "terça às 19h" é como o
    // gestor se refere a ele, não pelo nome da série.
    montar([mensalista()]);

    expect(screen.getByText(/Terça, 19:00 às 20:00/)).toBeInTheDocument();
  });

  it("soma a receita semanal só dos ativos", () => {
    montar([
      mensalista(),
      mensalista({ id: "s2", preco: 60 }),
      mensalista({ id: "s3", preco: 999, status: "ENCERRADA" }),
    ]);

    // 90 + 60, sem os 999 da série encerrada: contar encerrado inflaria a
    // receita recorrente com dinheiro que não entra mais.
    expect(screen.getByText(/2 ativos · R\$\s?150,00 por semana/)).toBeInTheDocument();
  });

  it("avisa quando faltam menos de duas semanas de horários gerados", () => {
    // **É a leitura da mitigação do ADR-0014.** Se o trabalho agendado parar,
    // as ocorrências somem em silêncio e o horário aparece livre na grade —
    // o cliente chega e a quadra foi vendida para outro.
    montar([mensalista({ materializadaAte: "2026-10-27" })]);

    expect(screen.getByText(/gere mais antes que a agenda abra o horário/)).toBeInTheDocument();
  });

  it("não avisa quando o horizonte está folgado", () => {
    montar([mensalista({ materializadaAte: "2026-12-15" })]);

    expect(screen.queryByText(/gere mais antes/)).not.toBeInTheDocument();
    expect(screen.getByText(/Horários criados até 15\/12\/2026/)).toBeInTheDocument();
  });

  it("série sem nenhuma semana gerada diz isso em vez de calcular folga", () => {
    montar([mensalista({ materializadaAte: null })]);

    expect(screen.getByText(/Nenhuma semana gerada ainda/)).toBeInTheDocument();
  });

  it("quem não administra não vê os botões de escrita", () => {
    // Criar e encerrar ocupa e devolve horário: é escrita de agenda, e o
    // `PapelGuard` recusaria. Botão que promete e nega é pior que ausente.
    montar([mensalista()], false);

    expect(screen.queryByRole("button", { name: "Encerrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar semanas" })).not.toBeInTheDocument();
  });

  it("série encerrada não oferece encerrar de novo", () => {
    montar([mensalista({ status: "ENCERRADA" })]);

    expect(screen.queryByRole("button", { name: "Encerrar" })).not.toBeInTheDocument();
  });

  it("a confirmação de encerrar diz o que acontece com o histórico", () => {
    // Quem encerra precisa saber **que o passado fica**: é o que o relatório
    // usa para fechar o mês já encerrado.
    //
    // A primeira versão deste teste cobrava um atributo `data-confirmar` que
    // o `BotaoDeAcao` nunca teve — eu afirmei o mecanismo em vez de olhar
    // qual é. A confirmação é um `window.confirm`, e o texto só chega a ser
    // lido se a recusa abortar de verdade: as duas coisas vão juntas aqui.
    const perguntou = vi.spyOn(window, "confirm").mockReturnValue(false);
    montar([mensalista()]);

    fireEvent.click(screen.getByRole("button", { name: "Encerrar" }));

    const pergunta = perguntou.mock.calls[0]?.[0] ?? "(não perguntou)";
    expect(pergunta).toContain("histórico");
    // E diz de quem é a mensalidade: numa arena com vários, "encerrar?" sem
    // nome não é informação suficiente para confirmar.
    expect(pergunta).toContain("Augusto Boff");
    expect(vi.mocked(encerrarMensalista)).not.toHaveBeenCalled();
  });

  it("lista vazia explica o que é um mensalista", () => {
    montar([]);

    expect(screen.getByText(/Nenhum mensalista cadastrado/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum mensalista ativo/)).toBeInTheDocument();
  });

  it("declara que a cobrança mensal é combinada fora do sistema", () => {
    // Sem isto o gestor esperaria a fatura sair sozinha. A tela promete o
    // controle, que foi o que a pesquisa pediu, e não o faturamento.
    montar([mensalista()]);

    expect(screen.getByText(/cobrança mensal é combinada fora do sistema/)).toBeInTheDocument();
  });
});
