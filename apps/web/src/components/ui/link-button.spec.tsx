// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LinkButton } from "./link-button";

describe("LinkButton", () => {
  // A regra vem do DESIGN.md: texto branco sobre coral reprova no contraste.
  it("escreve em ink sobre o coral, nunca em branco", () => {
    render(<LinkButton href="#comecar">Começar grátis</LinkButton>);

    const botao = screen.getByRole("link", { name: "Começar grátis" });
    expect(botao.className).toContain("bg-coral");
    expect(botao.className).toContain("text-ink");
    expect(botao.className).not.toContain("text-white");
  });

  it("mantém o alvo de toque em 44px (RNF-08)", () => {
    render(<LinkButton href="#comecar">Começar grátis</LinkButton>);

    expect(screen.getByRole("link").className).toContain("min-h-[44px]");
  });

  it("protege a aba de origem ao abrir um link externo", () => {
    render(
      <LinkButton href="https://github.com/LucasAck3rmann/rally" external>
        Ver no GitHub
      </LinkButton>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
