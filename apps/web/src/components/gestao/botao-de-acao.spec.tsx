// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BotaoDeAcao } from "./botao-de-acao";

/**
 * **O botão compartilhado das escritas do painel.**
 *
 * Estava em 25% de cobertura, e é o mesmo componente para pausar quadra,
 * bloquear horário, liberar horário, tirar da equipe e ligar ou desligar
 * cupom. Um defeito aqui atinge **toda** escrita do painel de uma vez, e o
 * que ele concentra não é aparência: é a confirmação antes do que custa
 * desfazer, o travamento durante o envio e a exibição da **mensagem do
 * servidor** em vez de uma genérica.
 *
 * A última é a que mais importa para quem usa. A API responde coisas como
 * *"promova outra pessoa a administrador antes"* — trocar isso por "não foi
 * possível" apagaria a única parte acionável da recusa.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function renderizar(props: Partial<Parameters<typeof BotaoDeAcao>[0]> = {}) {
  const acao = vi.fn().mockResolvedValue({ ok: true });
  render(
    <BotaoDeAcao acao={acao} {...props}>
      Pausar
    </BotaoDeAcao>,
  );
  return { acao };
}

const botao = (nome: RegExp | string = /pausar/i) =>
  screen.getByRole("button", { name: nome });

describe("BotaoDeAcao", () => {
  it("executa a ação no clique quando não há confirmação", async () => {
    const { acao } = renderizar();

    fireEvent.click(botao());

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    // Sem `pedirTexto`, nada é passado — o serviço decide o padrão.
    expect(acao).toHaveBeenCalledWith(undefined);
  });

  it("com confirmação, pergunta antes e desiste no cancelar", () => {
    // `confirmar` existe para o que custa desfazer. Se a recusa não abortasse,
    // a pergunta seria decorativa — e pior que não perguntar, porque ensina a
    // pessoa a confiar nela.
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { acao } = renderizar({ confirmar: "Tirar esta pessoa da equipe?" });

    fireEvent.click(botao());

    expect(window.confirm).toHaveBeenCalledWith("Tirar esta pessoa da equipe?");
    expect(acao).not.toHaveBeenCalled();
  });

  it("com confirmação aceita, executa", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { acao } = renderizar({ confirmar: "Confirma?" });

    fireEvent.click(botao());

    await waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
  });

  it("pede o texto e o repassa à ação", async () => {
    // É assim que o motivo do bloqueio chega ao servidor.
    vi.spyOn(window, "prompt").mockReturnValue("  manutenção da rede  ");
    const { acao } = renderizar({ pedirTexto: "Motivo do bloqueio" });

    fireEvent.click(botao());

    // Vai sem os espaços das pontas: espaço acidental viraria motivo com
    // espaço no relatório.
    await waitFor(() => expect(acao).toHaveBeenCalledWith("manutenção da rede"));
  });

  it("cancelar o pedido de texto aborta, mas texto vazio é resposta válida", async () => {
    // `prompt` devolve `null` no cancelar e `""` no OK sem digitar. Tratar os
    // dois igual faria "sem motivo" virar desistência, e o horário não seria
    // bloqueado.
    vi.spyOn(window, "prompt").mockReturnValue(null);
    const { acao } = renderizar({ pedirTexto: "Motivo" });
    fireEvent.click(botao());
    expect(acao).not.toHaveBeenCalled();

    vi.spyOn(window, "prompt").mockReturnValue("");
    const segundo = vi.fn().mockResolvedValue({ ok: true });
    render(
      <BotaoDeAcao acao={segundo} pedirTexto="Motivo">
        Bloquear
      </BotaoDeAcao>,
    );
    fireEvent.click(botao(/bloquear/i));

    await waitFor(() => expect(segundo).toHaveBeenCalledWith(""));
  });

  it("mostra a mensagem do servidor, inteira, num alerta", async () => {
    // **A asserção que mais importa.** `role="alert"` para o leitor de tela
    // anunciar sem a pessoa procurar, e o texto é o da API.
    const acao = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        erro:
          "Você é o único administrador de Arena Beira-Rio. Promova outra " +
          "pessoa a administrador antes de excluir a conta.",
      });
    render(<BotaoDeAcao acao={acao}>Tirar</BotaoDeAcao>);

    fireEvent.click(botao(/tirar/i));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/promova outra pessoa a administrador/i);
  });

  it("um novo clique limpa o erro anterior antes de tentar", async () => {
    // Sem isto, a mensagem da tentativa passada fica na tela durante a nova
    // e a pessoa não sabe se a segunda também falhou.
    const acao = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, erro: "Falhou a primeira vez." })
      .mockResolvedValueOnce({ ok: true });
    render(<BotaoDeAcao acao={acao}>Pausar</BotaoDeAcao>);

    fireEvent.click(botao());
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // **Espera o botão reabilitar antes do segundo clique.** Ele fica
    // desabilitado durante o envio, e o alerta pode aparecer no mesmo commit
    // em que `isPending` ainda é `true`: o clique cairia num botão
    // desabilitado e **desapareceria**, deixando o alerta na tela e o teste
    // esperando para sempre. Sem isto ele reprovava uma vez em quatro quando a
    // suíte roda inteira, que é a pior frequência possível: rara o bastante
    // para ser chamada de instabilidade e descartada. Quem usa a tela não
    // consegue clicar num botão desabilitado, e o teste também não deve.
    await waitFor(() => expect(botao()).not.toBeDisabled());

    fireEvent.click(botao());
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("sucesso não deixa alerta na tela", async () => {
    const { acao } = renderizar();
    fireEvent.click(botao());

    await waitFor(() => expect(acao).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o rótulo de ocupado é configurável, porque a ação tem nome próprio", async () => {
    const acao = vi.fn(
      () => new Promise<{ ok: true }>((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
    );
    render(
      <BotaoDeAcao acao={acao} rotuloOcupado="Liberando…">
        Liberar
      </BotaoDeAcao>,
    );

    fireEvent.click(botao(/liberar/i));

    expect(await screen.findByRole("button", { name: /liberando/i })).toBeDisabled();
  });

  it("é sempre type=button, para não submeter o formulário em volta", async () => {
    // Os botões de ação vivem dentro de linhas de tabela que estão dentro de
    // formulários. O padrão do HTML é `submit`, e sem isto um clique em
    // "Pausar" enviaria o formulário do filtro junto.
    renderizar();
    expect(botao()).toHaveAttribute("type", "button");
  });
});
