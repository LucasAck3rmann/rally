// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import Link from "next/link";

import { FormularioDeRedefinicao } from "@/components/gestao/formulario-de-redefinicao";
import { Emblem } from "@/components/ui/emblem";

export const metadata: Metadata = {
  title: "Redefinir senha",
  robots: { index: false, follow: false },
};

export default async function RedefinirSenha({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <Emblem className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink">Rally</span>
        </div>

        {token ? (
          <>
            <h1 className="font-display text-[32px] font-bold leading-tight text-ink">
              Escolha a nova senha
            </h1>
            <p className="mt-2 text-[15px] text-gray">Depois de salvar, entre no painel com ela.</p>
            <FormularioDeRedefinicao token={token} />
          </>
        ) : (
          <>
            {/* Chegar aqui sem token é link truncado pelo cliente de e-mail,
                que é comum. Mostrar o formulário mesmo assim só adiaria a
                recusa para depois da pessoa digitar a senha duas vezes. */}
            <h1 className="font-display text-[32px] font-bold leading-tight text-ink">
              Link incompleto
            </h1>
            <p className="mt-2 text-[15px] text-gray">
              O endereço veio sem o código de redefinição. Isso costuma acontecer quando o programa
              de e-mail quebra o link em duas linhas — copie o endereço inteiro, ou peça outro.
            </p>
            <Link
              href="/recuperar-senha"
              className="mt-7 inline-block h-12 rounded-button bg-coral px-6
                text-[15px] font-bold leading-[3rem] text-ink transition
                hover:brightness-95"
            >
              Pedir um novo link
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
