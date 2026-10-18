// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarMensalista, encerrarMensalista } from "@/lib/gestao/acoes";
import type { Mensalista, QuadraDaGestao } from "@/lib/gestao/contratos";
import { MensalistasDaArena } from "./mensalistas";

vi.mock("@/lib/gestao/acoes", () => ({
  criarMensalista: vi.fn(),
  encerrarMensalista: vi.fn(),
  materializarMensalista: vi.fn(),
}));

beforeEach(() => {
  // O padrão fica aqui, e não na fábrica do `vi.mock`: implementação posta na
  // fábrica depende de o `clearAllMocks` não apagá-la, e isso é detalhe de
  // versão do Vitest. Aqui é explícito e não envelhece.
  vi.mocked(criarMensalista).mockResolvedValue({
    ok: true,
    criadas: 9,
    puladas: [],
  });
});

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

function quadra(extras: Partial<QuadraDaGestao> = {}): QuadraDaGestao {
  return {
    id: "q1",
    nome: "Quadra 1",
    descricao: null,
    precoHora: 120,
    capacidade: null,
    fotos: [],
    comodidades: [],
    modalidades: [],
    faixasPreco: [],
    ativo: true,
    ...extras,
  };
}

function montar(
  lista: Mensalista[],
  podeEditar = true,
  quadras: QuadraDaGestao[] = [quadra()],
) {
  render(
    <MensalistasDaArena
      mensalistas={lista}
      quadras={quadras}
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

    expect(
      screen.getByText(/avança sozinho todo dia, e parou/),
    ).toBeInTheDocument();
  });

  it("não avisa quando o horizonte está folgado", () => {
    montar([mensalista({ materializadaAte: "2026-12-15" })]);

    expect(screen.queryByText(/e parou/)).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole("button", { name: "Cadastrar mensalista" }),
    ).not.toBeInTheDocument();
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
  function abrirCadastro(quadras?: QuadraDaGestao[]) {
    montar([], true, quadras);
    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar mensalista" }),
    );
  }

  /** Só o que o `required` cobra: o resto do formulário já vem preenchido. */
  function preencherMinimo(email = "augusto@rally.com.br", preco = "90") {
    fireEvent.change(screen.getByLabelText("E-mail do cliente"), {
      target: { value: email },
    });
    fireEvent.change(screen.getByLabelText("Preço por semana (R$)"), {
      target: { value: preco },
    });
  }

  it("sem quadra ativa, o cadastro diz o motivo em vez de abrir o formulário", () => {
    // Série semanal numa quadra pausada combinaria um horário que a arena não
    // vai cumprir, e o cliente só descobriria ao chegar.
    montar([], true, [quadra({ ativo: false })]);

    expect(
      screen.queryByRole("button", { name: "Cadastrar mensalista" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Nenhuma quadra ativa para receber mensalista/),
    ).toBeInTheDocument();
  });

  it("quadra pausada não entra nas opções", () => {
    abrirCadastro([
      quadra(),
      quadra({ id: "q2", nome: "Quadra 2 em manutenção", ativo: false }),
    ]);

    const opcoes = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toContain("Quadra 1");
    expect(opcoes).not.toContain("Quadra 2 em manutenção");
  });

  it("a tabela da quadra aparece como dica e o campo de preço fica vazio", () => {
    // Preencher por cima seria o defeito do `?? padrao` que apagou um `null`
    // deliberado no serviço: o número da tabela entraria como se fosse o
    // acordado, e um mensalista que combinou 90 sairia cobrado em 120.
    abrirCadastro();

    expect(screen.getByText(/esse horário sai por R\$ 120,00/)).toBeInTheDocument();
    expect(screen.getByLabelText("Preço por semana (R$)")).toHaveValue(null);
  });

  it("o cadastro converte os números e apara o e-mail", async () => {
    // Dia da semana e duração saem de um `select` como texto, e a API cobra
    // número. Mandar "4" onde vai 4 seria recusado pelo DTO, e o gestor leria
    // "erro de validação" sem saber em qual campo.
    abrirCadastro();
    preencherMinimo("  augusto@rally.com.br  ");
    fireEvent.change(screen.getByLabelText("Dia da semana"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText("Duração"), {
      target: { value: "90" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar mensalista" }),
    );

    await waitFor(() =>
      expect(vi.mocked(criarMensalista)).toHaveBeenCalledTimes(1),
    );
    expect(vi.mocked(criarMensalista)).toHaveBeenCalledWith("e1", {
      quadraId: "q1",
      clienteEmail: "augusto@rally.com.br",
      diaSemana: 4,
      horaInicio: "19:00",
      duracaoMinutos: 90,
      vigenciaInicio: HOJE,
      // Vigência em branco é "sem fim definido", e não a data de hoje.
      vigenciaFim: undefined,
      preco: 90,
      observacao: undefined,
    });
  });

  it("as semanas que não couberam aparecem e sobrevivem ao formulário fechar", async () => {
    // **É a promessa central do ADR-0014.** Ele recusou recusar a série
    // inteira e recusou deslocar a reserva no caminho: a colisão pula a semana
    // **e reporta**. Relatório que morre junto com o formulário não reporta —
    // depois dali, nada no sistema diz que aquela terça ficou de fora.
    vi.mocked(criarMensalista).mockResolvedValueOnce({
      ok: true,
      criadas: 8,
      puladas: [
        { data: "2026-10-27", motivo: "o horário já estava ocupado nessa semana" },
      ],
    });
    abrirCadastro();
    preencherMinimo();

    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar mensalista" }),
    );

    await waitFor(() =>
      expect(screen.getByText(/Uma semana não entrou/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/27\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/nada foi deslocado/)).toBeInTheDocument();
    // O formulário fechou — o campo de e-mail saiu da tela — e o aviso ficou.
    expect(screen.queryByLabelText("E-mail do cliente")).not.toBeInTheDocument();
  });

  it("recusa do servidor aparece no formulário, que continua aberto", async () => {
    // "Ninguém com esse e-mail tem conta no Rally" é acionável; fechar o
    // formulário obrigaria a digitar os sete campos de novo para corrigir um.
    vi.mocked(criarMensalista).mockResolvedValueOnce({
      ok: false,
      erro: "Ninguém com esse e-mail tem conta no Rally.",
    });
    abrirCadastro();
    preencherMinimo("fantasma@rally.com.br");

    fireEvent.click(
      screen.getByRole("button", { name: "Cadastrar mensalista" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Ninguém com esse e-mail tem conta no Rally.",
      ),
    );
    expect(screen.getByLabelText("E-mail do cliente")).toHaveValue(
      "fantasma@rally.com.br",
    );
  });
});
