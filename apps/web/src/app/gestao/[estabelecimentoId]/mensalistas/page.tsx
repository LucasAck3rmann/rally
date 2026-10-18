// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { MensalistasDaArena } from "@/components/gestao/mensalistas";
import { hojeNaQuadra } from "@/lib/formato";
import {
  mensalistasDoEstabelecimento,
  meuPapelEm,
} from "@/lib/gestao/consultas";
import { podeAdministrar } from "@/lib/gestao/permissoes";

export const metadata: Metadata = { title: "Mensalistas" };

export default async function Mensalistas({
  params,
}: {
  params: Promise<{ estabelecimentoId: string }>;
}) {
  const { estabelecimentoId } = await params;
  const [mensalistas, papel] = await Promise.all([
    mensalistasDoEstabelecimento(estabelecimentoId),
    meuPapelEm(estabelecimentoId),
  ]);

  return (
    <MensalistasDaArena
      mensalistas={mensalistas}
      estabelecimentoId={estabelecimentoId}
      // O "hoje" vem daqui, e não do componente: o cálculo de folga precisa do
      // dia na hora da arena, e o componente não conhece o fuso dela.
      hoje={hojeNaQuadra()}
      podeEditar={podeAdministrar(papel)}
    />
  );
}
