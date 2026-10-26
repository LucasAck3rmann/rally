// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { redefinir, type EstadoDaRedefinicao } from "@/app/recuperar-senha/acoes";
import { CAMPO } from "@/lib/estilos";

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-button bg-coral font-body text-[15px] font-bold
        text-ink transition hover:brightness-95 disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar nova senha"}
    </button>
  );
}

export function FormularioDeRedefinicao({ token }: { token: string }) {
  const [estado, acao] = useActionState<EstadoDaRedefinicao, FormData>(redefinir, {});

  return (
    <form action={acao} className="mt-7 space-y-4">
      {/* O token viaja em campo oculto e não no endereço do envio: assim ele
          não entra no histórico nem no registro do servidor quando o
          formulário é postado. */}
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray">
          Nova senha
        </span>
        <input
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className={CAMPO}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray">
          Repita a nova senha
        </span>
        <input
          name="confirmacao"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className={CAMPO}
        />
      </label>

      <p className="text-[13px] text-gray">Ao menos 6 caracteres.</p>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-button bg-coral/10 px-4 py-3 text-[14px] text-coral-deep"
        >
          {estado.erro}
        </p>
      ) : null}

      <Botao />

      <Link
        href="/recuperar-senha"
        className="block text-center text-[14px] text-gray hover:text-ink"
      >
        Pedir um novo link
      </Link>
    </form>
  );
}
