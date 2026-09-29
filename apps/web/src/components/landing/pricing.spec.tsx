// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pricing } from "./pricing";

describe("Planos", () => {
  it("mostra os três planos do RF-33", () => {
    render(<Pricing />);

    for (const plano of ["Free", "Pro", "Clube"]) {
      expect(screen.getByRole("heading", { name: plano })).toBeInTheDocument();
    }
  });

  it("destaca um único plano, e é o Pro", () => {
    render(<Pricing />);

    const selos = screen.getAllByText(/recomendado/i);
    expect(selos).toHaveLength(1);

    const cartao = selos[0].closest("article")!;
    expect(within(cartao).getByRole("heading", { name: "Pro" })).toBeInTheDocument();
  });

  it("avisa que os preços ainda estão em validação", () => {
    render(<Pricing />);

    expect(screen.getByText(/em validação/i)).toBeInTheDocument();
  });

  it("leva todo plano para o mesmo ponto de contato", () => {
    render(<Pricing />);

    const ctas = screen.getAllByRole("link");
    expect(ctas).toHaveLength(3);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "#comecar");
    }
  });
});
