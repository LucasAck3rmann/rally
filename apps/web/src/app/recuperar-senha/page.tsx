// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { FormularioDeRecuperacao } from "@/components/gestao/formulario-de-recuperacao";
import { Emblem } from "@/components/ui/emblem";

export const metadata: Metadata = {
  title: "Recuperar senha",
  description: "Receba um link para escolher uma nova senha.",
  robots: { index: false, follow: false },
};

export default function RecuperarSenha() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <Emblem className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink">Rally</span>
        </div>
        <h1 className="font-display text-[32px] font-bold leading-tight text-ink">
          Esqueceu a senha?
        </h1>
        <p className="mt-2 text-[15px] text-gray">
          Informe o e-mail da conta e enviaremos um link para escolher uma nova.
        </p>
        <FormularioDeRecuperacao />
      </div>
    </main>
  );
}
