// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { EquipeDaArena } from "@/components/gestao/equipe";
import { equipeDoEstabelecimento, meuPapelEm } from "@/lib/gestao/consultas";
import { podeAdministrar } from "@/lib/gestao/permissoes";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const [equipe, papel] = await Promise.all([
    equipeDoEstabelecimento(estabelecimentoId),
    meuPapelEm(estabelecimentoId),
  ]);

  return (
    <EquipeDaArena
      equipe={equipe}
      estabelecimentoId={estabelecimentoId}
      podeEditar={podeAdministrar(papel)}
    />
  );
}
