// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Privacidade } from "./privacidade";

const excluirMinhaConta = vi.fn();

vi.mock("@/lib/conta/acoes", () => ({
  excluirMinhaConta: () => excluirMinhaConta(),
}));

/**
 * Direitos do titular no painel da web (RNF-07, LGPD).
 *
 * O que se verifica aqui não é que os botões existem: é que a tela **diz o
 * que cada direito faz antes de a pessoa agir**, e que a recusa da API chega
 * inteira. Essas duas são as que fazem diferença para quem usa.
 */
describe("Privacidade e meus dados", () => {
  beforeEach(() => {
    excluirMinhaConta.mockReset();
    excluirMinhaConta.mockResolvedValue({ ok: true });
  });

  const baixar = () => screen.getByRole("link", { name: /baixar meus dados/i });
  const excluir = () => screen.getByRole("button", { name: /^excluir minha conta$/i });

  it("explica cada direito antes do controle", () => {
    render(<Privacidade email="lucas@arena.com.br" />);

    // Portabilidade: o arquivo precisa servir para outro sistema.
    expect(screen.getByText(/outro sistema consegue ler/i)).toBeInTheDocument();
    // Quem vai excluir merece saber disto **antes** de tocar.
    expect(screen.getByText(/obrigação fiscal/i)).toBeInTheDocument();
    expect(screen.getByText(/senha não vai no arquivo/i)).toBeInTheDocument();
  });

  it("avisa sobre o conflito do último administrador antes da tentativa", () => {
    // Sem isto, a pessoa só descobre a condição depois de confirmar uma ação
    // que ela acredita ser irreversível.
    render(<Privacidade email="lucas@arena.com.br" />);

    expect(screen.getByText(/único administrador/i)).toBeInTheDocument();
  });

  it("o download é um vínculo para a rota do servidor, não uma chamada do navegador", () => {
    // O token está num cookie httpOnly: o JavaScript da página não o lê, e
    // montar o download no cliente exigiria entregá-lo — o que desfaria a
    // razão de o cookie ser httpOnly.
    render(<Privacidade email="lucas@arena.com.br" />);

    expect(baixar()).toHaveAttribute("href", "/gestao/privacidade/meus-dados");
    expect(baixar()).toHaveAttribute("download");
  });

  it("mostra o e-mail da conta, para não excluir a conta errada", () => {
    render(<Privacidade email="lucas@arena.com.br" />);
    expect(screen.getAllByText(/lucas@arena\.com\.br/).length).toBeGreaterThan(0);
  });

  it("não exclui no primeiro clique", async () => {
    render(<Privacidade email="lucas@arena.com.br" />);

    fireEvent.click(excluir());

    expect(excluirMinhaConta).not.toHaveBeenCalled();
    expect(screen.getByText(/não tem como ser desfeito/i)).toBeInTheDocument();
  });

  it("cancelar fecha a confirmação sem excluir", async () => {
    render(<Privacidade email="lucas@arena.com.br" />);

    fireEvent.click(excluir());
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(excluirMinhaConta).not.toHaveBeenCalled();
    expect(screen.queryByText(/não tem como ser desfeito/i)).not.toBeInTheDocument();
  });

  it("confirmado, chama a exclusão uma vez", async () => {
    render(<Privacidade email="lucas@arena.com.br" />);

    fireEvent.click(excluir());
    fireEvent.click(screen.getByRole("button", { name: /excluir definitivamente/i }));

    await waitFor(() => expect(excluirMinhaConta).toHaveBeenCalledTimes(1));
  });

  it("a recusa da API aparece inteira e a tela continua utilizável", async () => {
    // A mensagem do servidor é a parte útil: ela diz o que fazer. Trocá-la
    // por texto genérico apagaria a única informação acionável.
    excluirMinhaConta.mockResolvedValue({
      ok: false,
      erro:
        "Você é o único administrador de Arena Beira-Rio. Promova outra pessoa " +
        "a administrador antes de excluir a conta.",
    });
    render(<Privacidade email="lucas@arena.com.br" />);

    fireEvent.click(excluir());
    fireEvent.click(screen.getByRole("button", { name: /excluir definitivamente/i }));

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(/promova outra pessoa/i);
    // Volta ao estado inicial: a ação não aconteceu, então o caminho para
    // tentar de novo continua aberto.
    expect(excluir()).toBeInTheDocument();
  });

  it("declara o prazo que o requisito estabelece", () => {
    render(<Privacidade email="lucas@arena.com.br" />);
    expect(screen.getByText(/15 dias/i)).toBeInTheDocument();
  });
});
