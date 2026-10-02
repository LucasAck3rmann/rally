// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { QuadrasDaArena } from "@/components/gestao/quadras";
import { quadrasDoEstabelecimento } from "@/lib/gestao/consultas";

export const metadata: Metadata = { title: "Quadras" };

export default async function Quadras({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const quadras = await quadrasDoEstabelecimento(estabelecimentoId);
  return <QuadrasDaArena quadras={quadras} />;
}
