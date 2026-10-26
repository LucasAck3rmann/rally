// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { pedirLink, type EstadoDaRecuperacao } from "@/app/recuperar-senha/acoes";
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
      {pending ? "Enviando…" : "Enviar link"}
    </button>
  );
}

/**
 * O que a tela diz depois de enviar.
 *
 * Exportado para ter teste próprio: a asserção que mais importa aqui é a de
 * que o texto **não confirma que a conta existe**, e ela depende de um
 * estado que a Server Action produz. Num componente à parte, a frase pode
 * ser verificada diretamente.
 */
export function AvisoDeEnvio() {
  return (
    <div className="mt-7 space-y-4">
      {/* O texto não confirma que a conta existe, porque a API também não
          confirma: a diferença entre as duas telas seria uma lista de
          clientes da arena. */}
      <p role="status" className="rounded-card bg-sand px-4 py-4 text-[15px] text-ink">
        Se houver conta com esse e-mail, o link de redefinição acabou de ser enviado. Ele vale por
        30 minutos.
      </p>
      <p className="text-[14px] text-gray">
        Não chegou? Confira a caixa de spam. Se pedir de novo logo em seguida, o link que já
        enviamos continua valendo.
      </p>
      <Link
        href="/entrar"
        className="inline-block text-[14px] font-semibold text-ink underline
          decoration-coral decoration-2 underline-offset-4"
      >
        Voltar para o login
      </Link>
    </div>
  );
}

export function FormularioDeRecuperacao() {
  const [estado, acao] = useActionState<EstadoDaRecuperacao, FormData>(pedirLink, {});

  if (estado.enviado) return <AvisoDeEnvio />;

  return (
    <form action={acao} className="mt-7 space-y-4">
      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.15em] text-gray">
          E-mail da conta
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

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-button bg-coral/10 px-4 py-3 text-[14px] text-coral-deep"
        >
          {estado.erro}
        </p>
      ) : null}

      <Botao />

      <Link href="/entrar" className="block text-center text-[14px] text-gray hover:text-ink">
        Lembrei a senha
      </Link>
    </form>
  );
}
