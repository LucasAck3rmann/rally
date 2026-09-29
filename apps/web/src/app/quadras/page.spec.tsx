// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuadrasPage from "./page";

const quadraDaApi = {
  id: "q1",
  nome: "Quadra 1 — Areia",
  precoHora: 120,
  fotos: ["http://localhost:3333/static/fotos/quadra-arena-hero.png"],
  capacidade: 4,
  modalidades: ["Beach Tennis", "Futevôlei"],
  estabelecimento: {
    id: "e1",
    nome: "Arena Beach Sapiranga",
    slug: "arena-beach-sapiranga",
    bairro: "Centro",
    cidade: "Sapiranga",
    uf: "RS",
    nota: 4.8,
    avaliacoes: 132,
    descontoPixPct: 5,
  },
  aoVivo: true,
};

function comResposta(corpo: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: status < 300, status, json: async () => corpo }) as Response),
  );
}

async function renderizar(filtros: { busca?: string; modalidade?: string } = {}) {
  render(await QuadrasPage({ searchParams: Promise.resolve(filtros) }));
}

afterEach(() => vi.unstubAllGlobals());

describe("Vitrine de quadras", () => {
  it("lista a quadra com preço em real e caminho para o detalhe", async () => {
    comResposta([quadraDaApi]);

    await renderizar();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/ache a quadra/i);
    expect(screen.getByRole("heading", { name: "Quadra 1 — Areia" })).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?120,00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quadra 1 — Areia/ })).toHaveAttribute(
      "href",
      "/quadras/q1",
    );
  });

  it("mostra o selo de jogo acontecendo agora", async () => {
    comResposta([quadraDaApi]);

    await renderizar();

    expect(screen.getByText(/jogo agora/i)).toBeInTheDocument();
  });

  // Ambiente fora do ar é estado de tela: os filtros seguem navegáveis.
  it("explica quando a API não responde, sem derrubar a página", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await renderizar();

    expect(screen.getByText(/não deu para carregar as quadras/i)).toBeInTheDocument();
    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("diferencia vitrine vazia de busca sem resultado", async () => {
    comResposta([]);
    await renderizar({ busca: "quadra inexistente" });
    expect(screen.getByText(/nenhuma quadra com esses filtros/i)).toBeInTheDocument();
  });

  it("marca o chip da modalidade filtrada como o atual", async () => {
    comResposta([quadraDaApi]);

    await renderizar({ modalidade: "Futevôlei" });

    const chip = screen.getByRole("link", { name: "Futevôlei" });
    expect(chip).toHaveAttribute("aria-current", "page");
    expect(chip).toHaveAttribute("href", "/quadras?modalidade=Futev%C3%B4lei");
  });
});
