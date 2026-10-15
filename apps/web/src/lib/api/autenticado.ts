// SPDX-License-Identifier: AGPL-3.0-or-later
import type { output, ZodTypeAny } from "zod";

import { baseDaApi, ErroDeApi } from "./client";
import { lerToken } from "../auth/sessao";

/** Erro que significa "a sessão acabou", e não "deu errado". */
export class SemSessao extends Error {
  constructor() {
    super("Sessão expirada.");
    this.name = "SemSessao";
  }
}

type Opcoes = {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  corpo?: unknown;
  parametros?: Record<string, string | number | undefined>;
};

/**
 * Chamada autenticada à API, para as telas de gestão.
 *
 * Separada de `buscarNaApi` de propósito: aquela serve ao site público e
 * **cacheia**. Resposta de gestão nunca pode ser cacheada — a agenda de um
 * estabelecimento apareceria para outro, e o cache do Next não sabe que a
 * resposta depende de quem perguntou.
 */
export async function chamarApiAutenticada<S extends ZodTypeAny>(
  caminho: string,
  schema: S,
  opcoes: Opcoes = {},
): Promise<output<S>> {
  const token = await lerToken();
  if (!token) throw new SemSessao();

  const url = new URL(`${baseDaApi()}${caminho}`);
  for (const [chave, valor] of Object.entries(opcoes.parametros ?? {})) {
    if (valor !== undefined) url.searchParams.set(chave, String(valor));
  }

  const resposta = await fetch(url, {
    method: opcoes.metodo ?? "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(opcoes.corpo ? { "Content-Type": "application/json" } : {}),
    },
    ...(opcoes.corpo ? { body: JSON.stringify(opcoes.corpo) } : {}),
  }).catch((causa: unknown) => {
    throw new ErroDeApi(0, "A API do Rally não respondeu.", causa);
  });

  if (resposta.status === 401) throw new SemSessao();
  if (!resposta.ok) {
    // A API devolve mensagem em pt-BR pronta para exibição; usar a dela é
    // melhor que inventar uma genérica que não diz o que fazer.
    const corpo = (await resposta.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const mensagem = Array.isArray(corpo?.message)
      ? corpo.message[0]
      : corpo?.message;
    throw new ErroDeApi(
      resposta.status,
      mensagem ?? `A API respondeu ${resposta.status} em ${caminho}.`,
    );
  }

  if (resposta.status === 204) return undefined as output<S>;

  const analise = schema.safeParse(await resposta.json());
  if (!analise.success) {
    throw new ErroDeApi(500, `Resposta de ${caminho} fora do contrato.`, analise.error);
  }
  return analise.data;
}
