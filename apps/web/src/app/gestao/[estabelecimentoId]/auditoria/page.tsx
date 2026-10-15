// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { TrilhaDaArena } from "@/components/gestao/trilha";
import { meuPapelEm, trilhaDoEstabelecimento } from "@/lib/gestao/consultas";
import { podeAdministrar } from "@/lib/gestao/permissoes";

export const metadata: Metadata = { title: "Auditoria" };

/**
 * Quantos registros pedir.
 *
 * Estrito de propósito: a API já limita a 500, mas aceitar qualquer número da
 * URL faria a tela anunciar "mostrando os 99999 mais recentes" enquanto a API
 * devolveu 500 — a tela mentiria sobre o próprio limite, que é justamente o
 * que ela existe para declarar.
 */
function tetoPedido(limite?: string): number {
  return limite === "500" ? 500 : 100;
}

export default async function Auditoria({
  params,
  searchParams,
}: {
  params: Promise<{ estabelecimentoId: string }>;
  searchParams: Promise<{ busca?: string; entidade?: string; limite?: string }>;
}) {
  const { estabelecimentoId } = await params;
  const pedido = await searchParams;
  const papel = await meuPapelEm(estabelecimentoId);

  // **O papel vem antes da chamada, e não depois.** A rota da trilha é a única
  // leitura da gestão restrita ao administrador, de modo que buscar primeiro e
  // tratar o erro depois entregaria um 403 cru para o atendente que clicou num
  // link. Foi a razão de `podeAdministrar` existir: esconder o que o servidor
  // recusaria, sem fingir que é a interface quem autoriza.
  if (!podeAdministrar(papel)) {
    return (
      <div className="p-6 md:p-10">
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Trilha de auditoria
        </h1>
        <p className="mt-3 max-w-prose text-[15px] text-gray">
          {papel === null
            ? "Você não tem vínculo com esta arena."
            : "Esta tela é só do administrador da arena. A trilha registra quem executou cada ação sensível, e quem recebeu acesso de operação não audita a própria operação."}
        </p>
      </div>
    );
  }

  const teto = tetoPedido(pedido.limite);
  const trilha = await trilhaDoEstabelecimento(estabelecimentoId, teto);

  return (
    <TrilhaDaArena
      trilha={trilha}
      estabelecimentoId={estabelecimentoId}
      filtro={{
        busca: pedido.busca,
        entidade: pedido.entidade,
        limite: pedido.limite === "500" ? 500 : undefined,
      }}
      teto={teto}
    />
  );
}
