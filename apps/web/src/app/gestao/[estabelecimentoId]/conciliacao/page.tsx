// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { ConciliacaoDaArena } from "@/components/gestao/conciliacao";
import { conciliacaoDoEstabelecimento, meuPapelEm } from "@/lib/gestao/consultas";

export const metadata: Metadata = { title: "Conciliação" };

export default async function Conciliacao({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const [conciliacao, papel] = await Promise.all([
    conciliacaoDoEstabelecimento(estabelecimentoId),
    meuPapelEm(estabelecimentoId),
  ]);

  return (
    <ConciliacaoDaArena
      conciliacao={conciliacao}
      estabelecimentoId={estabelecimentoId}
      podeExpirar={papel === "ADMIN" || papel === "MANTENEDOR"}
    />
  );
}
