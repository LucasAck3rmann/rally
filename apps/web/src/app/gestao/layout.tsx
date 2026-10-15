// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BarraLateral } from "@/components/gestao/barra-lateral";
import { SemSessao } from "@/lib/api/autenticado";
import { meusEstabelecimentos } from "@/lib/gestao/consultas";

export const metadata: Metadata = {
  title: { default: "Gestão", template: "%s · Gestão · Rally" },
  robots: { index: false, follow: false },
};

/**
 * Casca do painel: barra lateral com o seletor de estabelecimento.
 *
 * A lista de vínculos é buscada **aqui** e passada para baixo. Cada tela
 * buscar por conta própria faria quatro chamadas iguais por navegação, e o
 * seletor pisca a cada troca de página.
 */
export default async function LayoutDaGestao({ children }: { children: ReactNode }) {
  let estabelecimentos;
  try {
    estabelecimentos = await meusEstabelecimentos();
  } catch (erro) {
    // Sem sessão volta para a entrada; qualquer outra falha sobe e vira a
    // página de erro — fingir "você não gerencia nada" esconderia a API
    // fora do ar atrás de uma mensagem que culpa o usuário.
    if (erro instanceof SemSessao) redirect("/entrar");
    throw erro;
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <BarraLateral estabelecimentos={estabelecimentos} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
