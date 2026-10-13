// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { CuponsDaArena } from "@/components/gestao/cupons";
import { cuponsDoEstabelecimento, meuPapelEm } from "@/lib/gestao/consultas";
import { podeAdministrar } from "@/lib/gestao/permissoes";

export const metadata: Metadata = { title: "Cupons" };

export default async function Cupons({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const [cupons, papel] = await Promise.all([
    cuponsDoEstabelecimento(estabelecimentoId),
    meuPapelEm(estabelecimentoId),
  ]);

  return (
    <CuponsDaArena
      cupons={cupons}
      estabelecimentoId={estabelecimentoId}
      podeEditar={podeAdministrar(papel)}
    />
  );
}
