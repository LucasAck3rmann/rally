// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FormularioDeEntrada } from "@/components/gestao/formulario-de-entrada";
import { Emblem } from "@/components/ui/emblem";
import { lerToken } from "@/lib/auth/sessao";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse o painel de gestão da sua arena.",
  // A tela de login não deve entrar em busca: ela não é conteúdo, e a
  // presença dela num índice só ajuda quem procura porta de entrada.
  robots: { index: false, follow: false },
};

export default async function Entrar() {
  if (await lerToken()) redirect("/gestao");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <Emblem className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink">Rally</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">
            · gestão
          </span>
        </div>
        <h1 className="font-display text-[32px] font-bold leading-tight text-ink">
          Entrar no painel
        </h1>
        <p className="mt-2 text-[15px] text-gray">
          Use a mesma conta do aplicativo.
        </p>
        <FormularioDeEntrada />
      </div>
    </main>
  );
}
