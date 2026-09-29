// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Faq } from "./faq";

describe("FAQ", () => {
  it("abre e fecha sem JavaScript, usando details/summary", () => {
    const { container } = render(<Faq />);

    const blocos = container.querySelectorAll("details");
    expect(blocos.length).toBeGreaterThanOrEqual(5);
    for (const bloco of blocos) {
      expect(bloco.querySelector("summary")).not.toBeNull();
    }
  });

  it("não promete o que ainda não existe: os replays aparecem como próxima fase", () => {
    render(<Faq />);

    expect(screen.getByText(/os replays já estão funcionando/i)).toBeInTheDocument();
    expect(screen.getByText(/ainda não\./i)).toBeInTheDocument();
  });

  it("publica as mesmas perguntas como dados estruturados FAQPage", () => {
    const { container } = render(<Faq />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();

    const dados = JSON.parse(script!.innerHTML);
    expect(dados["@type"]).toBe("FAQPage");
    expect(dados.mainEntity).toHaveLength(container.querySelectorAll("details").length);

    for (const pergunta of dados.mainEntity) {
      expect(screen.getByText(pergunta.name)).toBeInTheDocument();
    }
  });
});
