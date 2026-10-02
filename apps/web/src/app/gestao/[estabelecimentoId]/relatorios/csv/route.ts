// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";

import { baseDaApi } from "@/lib/api/client";
import { lerToken } from "@/lib/auth/sessao";

/**
 * Repassa o CSV da API para o navegador (RF-28).
 *
 * Existe porque o token está num cookie **httpOnly**: um link direto para a
 * API não levaria `Authorization`, e dar o token ao JavaScript da página
 * para montar o download desfaria a razão de o cookie ser httpOnly. Então o
 * servidor baixa com a sessão e devolve o arquivo.
 */
export async function GET(
  requisicao: Request,
  contexto: { params: Promise<{ estabelecimentoId: string }> },
) {
  const token = await lerToken();
  if (!token) {
    return NextResponse.redirect(new URL("/entrar", requisicao.url));
  }

  const { estabelecimentoId } = await contexto.params;
  const pedido = new URL(requisicao.url);
  const alvo = new URL(
    `${baseDaApi()}/gestao/estabelecimentos/${estabelecimentoId}/relatorios/csv`,
  );
  for (const chave of ["de", "ate"]) {
    const valor = pedido.searchParams.get(chave);
    if (valor) alvo.searchParams.set(chave, valor);
  }

  const resposta = await fetch(alvo, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);

  if (!resposta || !resposta.ok) {
    // Texto simples e não JSON: quem clicou esperava um arquivo, e um
    // objeto de erro na tela não diz nada a quem não é programador.
    return new NextResponse(
      "Não foi possível gerar o relatório. Tente de novo em instantes.",
      { status: resposta?.status ?? 502, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  // O nome do arquivo vem da API, que já o monta com o período.
  const disposicao =
    resposta.headers.get("content-disposition") ??
    'attachment; filename="rally-relatorio.csv"';

  return new NextResponse(await resposta.text(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": disposicao,
      "Cache-Control": "no-store",
    },
  });
}
