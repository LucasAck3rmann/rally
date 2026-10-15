// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import Link from "next/link";

import { Emblem } from "@/components/ui/emblem";
import { baseDaApi } from "@/lib/api/client";

export const metadata: Metadata = {
  title: "Confirmar e-mail",
  robots: { index: false, follow: false },
};

type Desfecho =
  | { tipo: "confirmado" }
  | { tipo: "ja-confirmado" }
  | { tipo: "recusado"; motivo: string };

/**
 * Confirma o endereço a partir do link do e-mail (RF-03).
 *
 * A chamada acontece **na renderização do servidor**, e não num botão: quem
 * abre este endereço já demonstrou a intenção ao clicar no link do e-mail, e
 * pedir mais um clique só adiaria o que ele veio fazer.
 */
async function confirmar(token: string): Promise<Desfecho> {
  let resposta: Response;
  try {
    resposta = await fetch(`${baseDaApi()}/auth/verificar-email`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { tipo: "recusado", motivo: "A API do Rally não respondeu." };
  }

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const mensagem = Array.isArray(corpo?.message)
      ? corpo.message[0]
      : corpo?.message;
    return { tipo: "recusado", motivo: mensagem ?? "Link inválido." };
  }

  const corpo = (await resposta.json().catch(() => null)) as
    | { jaConfirmado?: boolean }
    | null;
  return corpo?.jaConfirmado ? { tipo: "ja-confirmado" } : { tipo: "confirmado" };
}

export default async function ConfirmarEmail({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const desfecho = token ? await confirmar(token) : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-16">
      <div className="w-full max-w-[460px]">
        <div className="mb-8 flex items-center gap-3">
          <Emblem className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink">Rally</span>
        </div>

        <h1 className="font-display text-[32px] font-bold leading-tight text-ink">
          {desfecho?.tipo === "confirmado" || desfecho?.tipo === "ja-confirmado"
            ? "E-mail confirmado"
            : "Não deu para confirmar"}
        </h1>

        <p className="mt-3 text-[15px] text-gray">
          {desfecho === null
            ? "O endereço veio sem o código. Isso costuma acontecer quando o programa de e-mail quebra o link em duas linhas — copie o endereço inteiro."
            : desfecho.tipo === "confirmado"
              ? "Pronto. Os avisos das suas reservas vão chegar neste endereço."
              : desfecho.tipo === "ja-confirmado"
                ? // Clicar duas vezes no mesmo link acontece o tempo todo, e
                  // dizer "erro" ensinaria a desconfiar de algo que deu certo.
                  "Este endereço já estava confirmado. Não precisa fazer nada."
                : desfecho.motivo}
        </p>

        <Link
          href="/entrar"
          className="mt-8 inline-block h-12 rounded-button bg-coral px-6 text-[15px]
            font-bold leading-[3rem] text-ink transition hover:brightness-95"
        >
          Ir para o login
        </Link>
      </div>
    </main>
  );
}
