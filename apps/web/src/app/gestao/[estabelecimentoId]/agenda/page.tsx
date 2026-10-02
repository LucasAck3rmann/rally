// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { AgendaDaArena } from "@/components/gestao/agenda";
import { hojeNaQuadra, proximosDias } from "@/lib/formato";
import { agendaDoDia, meuPapelEm } from "@/lib/gestao/consultas";

export const metadata: Metadata = { title: "Agenda" };

export default async function Agenda({
  params,
  searchParams,
}: {
  params: Promise<{ estabelecimentoId: string }>;
  searchParams: Promise<{ data?: string }>;
}) {
  const { estabelecimentoId } = await params;
  const { data: pedida } = await searchParams;

  const dias = proximosDias(14);
  // A data vem da URL para o link ser compartilhável. Fora do formato cai
  // em hoje em vez de virar 400 — quem digitou na barra não merece erro.
  const data = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hojeNaQuadra();

  const [agenda, papel] = await Promise.all([
    agendaDoDia(estabelecimentoId, data),
    meuPapelEm(estabelecimentoId),
  ]);

  return (
    <AgendaDaArena
      agenda={agenda}
      dias={dias}
      estabelecimentoId={estabelecimentoId}
      podeBloquear={papel === "ADMIN" || papel === "MANTENEDOR"}
    />
  );
}
