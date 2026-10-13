// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError } from "rxjs";

import { Latencia } from "./latencia";
import { TempoDeRespostaInterceptor } from "./tempo-de-resposta.interceptor";

function contexto(
  req: Record<string, unknown>,
  tipo: "http" | "rpc" = "http",
): ExecutionContext {
  return {
    getType: () => tipo,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const respondeOk: CallHandler = { handle: () => of({ ok: true }) };
const falha: CallHandler = {
  handle: () => throwError(() => new Error("estourou")),
};

/** Espera a sequência terminar, ignorando o erro quando houver. */
async function consumir(fonte: ReturnType<CallHandler["handle"]>) {
  await new Promise<void>((resolve) =>
    fonte.subscribe({ next: () => {}, error: () => resolve(), complete: resolve }),
  );
}

describe("TempoDeRespostaInterceptor (RNF-01)", () => {
  let latencia: Latencia;
  let interceptor: TempoDeRespostaInterceptor;

  beforeEach(() => {
    latencia = new Latencia();
    interceptor = new TempoDeRespostaInterceptor(latencia);
  });

  it("agrupa pelo padrão da rota, não pelo caminho pedido", async () => {
    // Sem isto, cada identificador viraria uma rota diferente no resumo: a
    // memória cresceria sem teto e todo p95 seria sobre uma amostra só.
    const req = {
      method: "GET",
      baseUrl: "/api/v1",
      path: "/quadras/clx123",
      route: { path: "/quadras/:id" },
    };

    await consumir(interceptor.intercept(contexto(req), respondeOk));
    await consumir(
      interceptor.intercept(
        contexto({ ...req, path: "/quadras/clx999" }),
        respondeOk,
      ),
    );

    const resumo = latencia.resumo();
    expect(resumo).toHaveLength(1);
    expect(resumo[0].rota).toBe("GET /api/v1/quadras/:id");
    expect(resumo[0].chamadas).toBe(2);
  });

  it("a rota que falha devagar também entra na conta", async () => {
    // Deixá-la fora faria o p95 parecer melhor do que é — justamente a
    // rota com problema seria a invisível.
    const req = {
      method: "POST",
      baseUrl: "/api/v1",
      path: "/reservas",
      route: { path: "/reservas" },
    };

    await consumir(interceptor.intercept(contexto(req), falha));

    expect(latencia.resumo()[0]).toMatchObject({
      rota: "POST /api/v1/reservas",
      chamadas: 1,
    });
  });

  it("sem padrão de rota, cai no caminho pedido em vez de perder a medida", async () => {
    // Acontece com 404 e com arquivo estático: o Express não casou rota
    // nenhuma, e perder o tempo gasto esconderia justamente o caminho que
    // ninguém esperava ser lento.
    const req = { method: "GET", baseUrl: "", path: "/nao-existe" };

    await consumir(interceptor.intercept(contexto(req), respondeOk));

    expect(latencia.resumo()[0].rota).toBe("GET /nao-existe");
  });

  it("não mede o que não é requisição HTTP", async () => {
    // O job de expiração roda por `@Cron`, fora de rota; medi-lo como rota
    // poluiria o resumo com algo que nenhum cliente esperou.
    await consumir(
      interceptor.intercept(contexto({ method: "GET" }, "rpc"), respondeOk),
    );

    expect(latencia.resumo()).toEqual([]);
  });

  it("mede em milissegundos, com uma resposta imediata perto de zero", async () => {
    const req = { method: "GET", baseUrl: "", path: "/health", route: { path: "/health" } };
    await consumir(interceptor.intercept(contexto(req), respondeOk));

    const [r] = latencia.resumo();
    expect(r.p95).toBeGreaterThanOrEqual(0);
    expect(r.p95).toBeLessThan(1000);
  });
});
