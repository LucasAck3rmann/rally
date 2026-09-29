// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErroDeApi } from "./client";
import { listarQuadras, obterDisponibilidade } from "./quadras";

const quadraDaApi = {
  id: "q1",
  nome: "Quadra 1 — Areia",
  precoHora: 120,
  fotos: ["http://localhost:3333/static/fotos/quadra-arena-hero.png"],
  capacidade: 4,
  modalidades: ["Beach Tennis"],
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
};

function respostaCom(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("contrato da vitrine", () => {
  it("lê a listagem e assume que quem não traz selo não está ao vivo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaCom([quadraDaApi])),
    );

    const [quadra] = await listarQuadras();

    expect(quadra.nome).toBe("Quadra 1 — Areia");
    expect(quadra.estabelecimento.nota).toBe(4.8);
    expect(quadra.aoVivo).toBe(false);
  });

  it("manda busca e modalidade como parâmetros, e omite o que está vazio", async () => {
    const chamada = vi.fn(async (_url: URL, _init?: RequestInit) => respostaCom([]));
    vi.stubGlobal("fetch", chamada);

    await listarQuadras({ busca: "arena", modalidade: undefined });

    const url = chamada.mock.calls[0][0];
    expect(url.pathname).toBe("/api/v1/quadras");
    expect(url.searchParams.get("busca")).toBe("arena");
    expect(url.searchParams.has("modalidade")).toBe(false);
  });

  // O schema é a fronteira: resposta fora do contrato tem de explodir aqui,
  // não três componentes adiante com um campo indefinido na tela.
  it("recusa resposta fora do contrato", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaCom([{ id: "q1", nome: "sem preço" }])),
    );

    await expect(listarQuadras()).rejects.toBeInstanceOf(ErroDeApi);
  });

  it("trata API fora do ar como falha de ambiente, não de dado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const erro = await listarQuadras().catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDeApi);
    expect((erro as ErroDeApi).status).toBe(0);
    expect((erro as ErroDeApi).foraDoAr).toBe(true);
  });

  it("propaga o 404 da API com o status intacto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaCom({ message: "não achou" }, 404)),
    );

    const erro = await listarQuadras().catch((e: unknown) => e);

    expect((erro as ErroDeApi).status).toBe(404);
    expect((erro as ErroDeApi).foraDoAr).toBe(false);
  });

  // Um horário pode ser tomado a qualquer momento: grade não pode vir de cache.
  it("busca a grade do dia sem cache", async () => {
    const chamada = vi.fn(async (_url: URL, _init?: RequestInit) =>
      respostaCom({ data: "2026-10-01", slotMinutos: 60, slots: [] }),
    );
    vi.stubGlobal("fetch", chamada);

    await obterDisponibilidade("q1", "2026-10-01");

    const opcoes = chamada.mock.calls[0][1]!;
    expect(opcoes.cache).toBe("no-store");
  });
});
