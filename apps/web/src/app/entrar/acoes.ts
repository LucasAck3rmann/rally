// SPDX-License-Identifier: AGPL-3.0-or-later
"use server";

import { redirect } from "next/navigation";

import { baseDaApi } from "@/lib/api/client";
import { gravarToken } from "@/lib/auth/sessao";
import { Sessao } from "@/lib/gestao/contratos";

export type EstadoDoLogin = { erro?: string };

/**
 * Entra no painel.
 *
 * Roda **no servidor**: a senha nunca passa pelo JavaScript da página e o
 * token volta direto para um cookie httpOnly, sem encostar em
 * `localStorage`. É o que torna um XSS incapaz de levar a sessão embora.
 */
export async function entrar(
  _anterior: EstadoDoLogin,
  dados: FormData,
): Promise<EstadoDoLogin> {
  const email = String(dados.get("email") ?? "").trim();
  const senha = String(dados.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${baseDaApi()}/auth/login`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, senha }),
    });
  } catch {
    return { erro: "A API do Rally não respondeu. Tente de novo." };
  }

  if (!resposta.ok) {
    // Mensagem única para e-mail inexistente e senha errada: dizer qual dos
    // dois falhou entrega a quem tenta adivinhar que o e-mail existe.
    return { erro: "E-mail ou senha incorretos." };
  }

  const analise = Sessao.safeParse(await resposta.json().catch(() => null));
  if (!analise.success) {
    return { erro: "A API respondeu fora do contrato esperado." };
  }

  await gravarToken(analise.data.accessToken);
  redirect("/gestao");
}
