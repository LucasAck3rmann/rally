// SPDX-License-Identifier: AGPL-3.0-or-later
import type { output, ZodTypeAny } from "zod";

/**
 * Base da API do Rally. Local é `localhost:3333`; no docker-compose o serviço
 * `web` fala com o `api` pelo nome do serviço (ver docker-compose.yml).
 */
const BASE = (process.env.API_URL ?? "http://localhost:3333/api/v1").replace(/\/$/, "");

/** Falha de comunicação com a API — `status` 0 quer dizer "não respondeu". */
export class ErroDeApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly causa?: unknown,
  ) {
    super(mensagem);
    this.name = "ErroDeApi";
  }

  /** Sem rota até a API: é ambiente fora do ar, não dado inexistente. */
  get foraDoAr(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

type Opcoes = {
  parametros?: Record<string, string | undefined>;
  /** Segundos de cache. `0` busca sempre — use para dado que muda a cada minuto. */
  revalidarEm?: number;
  tempoLimiteMs?: number;
};

export function baseDaApi(): string {
  return BASE;
}

/**
 * Busca e **valida o contrato** antes de devolver. Resposta fora do formato é
 * defeito nosso (API e web desalinhadas), então falha alto em vez de espalhar
 * `undefined` pela árvore de componentes.
 */
export async function buscarNaApi<S extends ZodTypeAny>(
  caminho: string,
  schema: S,
  opcoes: Opcoes = {},
): Promise<output<S>> {
  const url = new URL(`${BASE}${caminho}`);
  for (const [chave, valor] of Object.entries(opcoes.parametros ?? {})) {
    if (valor) url.searchParams.set(chave, valor);
  }

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), opcoes.tempoLimiteMs ?? 8000);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      signal: controle.signal,
      headers: { Accept: "application/json" },
      ...(opcoes.revalidarEm === 0
        ? { cache: "no-store" as const }
        : { next: { revalidate: opcoes.revalidarEm ?? 30 } }),
    });
  } catch (causa) {
    throw new ErroDeApi(0, `A API do Rally não respondeu em ${url.origin}.`, causa);
  } finally {
    clearTimeout(limite);
  }

  if (!resposta.ok) {
    throw new ErroDeApi(resposta.status, `A API respondeu ${resposta.status} em ${caminho}.`);
  }

  const analise = schema.safeParse(await resposta.json());
  if (!analise.success) {
    throw new ErroDeApi(500, `Resposta de ${caminho} fora do contrato esperado.`, analise.error);
  }
  return analise.data;
}
