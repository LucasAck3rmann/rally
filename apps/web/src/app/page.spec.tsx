// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Landing", () => {
  it("apresenta a promessa do produto num único h1", () => {
    render(<Home />);

    const titulos = screen.getAllByRole("heading", { level: 1 });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toHaveTextContent(/do agendamento ao replay/i);
  });

  it("expõe os marcos de navegação da página", () => {
    render(<Home />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("descreve todas as fotos para quem usa leitor de tela (RNF-08)", () => {
    render(<Home />);

    const imagens = screen.getAllByRole("img");
    expect(imagens.length).toBeGreaterThan(0);
    for (const imagem of imagens) {
      expect(imagem).toHaveAccessibleName();
    }
  });

  it("aponta todos os CTAs principais para a seção de contato", () => {
    render(<Home />);

    const ctas = screen.getAllByRole("link", { name: /começar/i });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      // O cabeçalho é compartilhado com /quadras, então usa "/#comecar";
      // dentro da landing a âncora relativa basta.
      expect(cta.getAttribute("href")).toMatch(/^\/?#comecar$/);
    }
  });

  it("mantém cada âncora do cabeçalho com destino na página", () => {
    const { container } = render(<Home />);

    const ancoras = Array.from(container.querySelectorAll('a[href^="#"]'))
      .map((elemento) => elemento.getAttribute("href")!.slice(1))
      .filter(Boolean);

    expect(ancoras.length).toBeGreaterThan(0);
    for (const destino of new Set(ancoras)) {
      expect(container.querySelector(`#${destino}`)).not.toBeNull();
    }
  });
});
