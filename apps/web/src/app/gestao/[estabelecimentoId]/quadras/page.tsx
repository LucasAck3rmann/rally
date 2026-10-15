// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { QuadrasDaArena } from "@/components/gestao/quadras";
import { meuPapelEm, quadrasDoEstabelecimento } from "@/lib/gestao/consultas";
import { podeAdministrar } from "@/lib/gestao/permissoes";

export const metadata: Metadata = { title: "Quadras" };

export default async function Quadras({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const [quadras, papel] = await Promise.all([
    quadrasDoEstabelecimento(estabelecimentoId),
    meuPapelEm(estabelecimentoId),
  ]);

  return (
    <QuadrasDaArena
      quadras={quadras}
      estabelecimentoId={estabelecimentoId}
      podeEditar={podeAdministrar(papel)}
    />
  );
}
