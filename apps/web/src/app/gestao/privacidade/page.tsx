// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Privacidade } from "@/components/gestao/privacidade";
import { SemSessao } from "@/lib/api/autenticado";
import { minhaConta } from "@/lib/conta/consultas";

export const metadata: Metadata = { title: "Privacidade" };

/**
 * Privacidade e dados do titular (RNF-07, LGPD).
 *
 * Fica em `/gestao/privacidade`, e **não** sob `/gestao/[estabelecimentoId]`:
 * os dados são da pessoa, não da arena. Pendurá-los no caminho do
 * estabelecimento sugeriria uma cópia por arena e quebraria ao trocar de
 * arena — além de convidar alguém a algum dia filtrar a exportação pelo
 * `tenant`, que é o oposto do que o direito pede.
 */
export default async function PaginaDePrivacidade() {
  try {
    const conta = await minhaConta();
    return <Privacidade email={conta.email} />;
  } catch (erro) {
    if (erro instanceof SemSessao) redirect("/entrar");
    throw erro;
  }
}
