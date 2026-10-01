// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { PainelDaArena } from "@/components/gestao/painel";
import { painelDoEstabelecimento } from "@/lib/gestao/consultas";

export const metadata: Metadata = { title: "Painel" };

const PERIODOS = [7, 30, 90];

export default async function Painel({
  params,
  searchParams,
}: {
  params: Promise<{ estabelecimentoId: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { estabelecimentoId } = await params;
  const { dias: pedido } = await searchParams;

  // Período vem da URL para o link ser compartilhável e o voltar do
  // navegador funcionar. Valor fora da lista cai nos 7 dias em vez de
  // virar 400 — quem digitou "?dias=abc" na barra não merece erro.
  const dias = PERIODOS.includes(Number(pedido)) ? Number(pedido) : 7;
  const painel = await painelDoEstabelecimento(estabelecimentoId, dias);

  return (
    <PainelDaArena
      painel={painel}
      dias={dias}
      periodos={PERIODOS}
      estabelecimentoId={estabelecimentoId}
    />
  );
}
