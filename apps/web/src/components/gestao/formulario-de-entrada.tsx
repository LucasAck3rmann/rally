// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { entrar, type EstadoDoLogin } from "@/app/entrar/acoes";

const CAMPO =
  "w-full rounded-button border border-line bg-white px-4 py-3 text-[15px] " +
  "text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-button bg-coral font-body text-[15px] font-bold
        text-ink transition hover:brightness-95 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioDeEntrada() {
  const [estado, acao] = useActionState<EstadoDoLogin, FormData>(entrar, {});

  return (
    <form action={acao} className="mt-7 space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray">
          E-mail
        </span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className={CAMPO}
          placeholder="voce@arena.com.br"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray">
          Senha
        </span>
        <input
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          className={CAMPO}
        />
      </label>

      {estado.erro ? (
        // `role="alert"` para o leitor de tela anunciar a falha sem o
        // usuário precisar procurar o texto vermelho.
        <p
          role="alert"
          className="rounded-button bg-coral/10 px-4 py-3 text-[14px] text-coral-deep"
        >
          {estado.erro}
        </p>
      ) : null}

      <Botao />
    </form>
  );
}
