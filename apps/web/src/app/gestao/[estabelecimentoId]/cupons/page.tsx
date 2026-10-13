// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { CuponsDaArena } from "@/components/gestao/cupons";
import { cuponsDoEstabelecimento, meuPapelEm } from "@/lib/gestao/consultas";

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
      // Só ADMIN: é o que o `@Papeis(Role.ADMIN)` do controlador aceita, e o
      // guard não tem hierarquia de papéis. Mostrar o botão para quem o
      // servidor recusaria entregaria um 403 no lugar de uma tela honesta.
      podeEditar={papel === "ADMIN"}
    />
  );
}
