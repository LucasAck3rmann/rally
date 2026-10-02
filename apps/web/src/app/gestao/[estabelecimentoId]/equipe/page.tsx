// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { EquipeDaArena } from "@/components/gestao/equipe";
import { equipeDoEstabelecimento } from "@/lib/gestao/consultas";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const equipe = await equipeDoEstabelecimento(estabelecimentoId);
  return <EquipeDaArena equipe={equipe} />;
}
