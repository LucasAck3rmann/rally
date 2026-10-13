// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";

import { baseDaApi } from "../api/client";
import { lerToken } from "../auth/sessao";

/**
 * Repassa um arquivo da API para o navegador, com a sessão do cookie.
 *
 * Existe porque o token está num cookie **httpOnly**: um link direto para a
 * API não levaria `Authorization`, e dar o token ao JavaScript da página
 * para montar o download desfaria a razão de o cookie ser httpOnly. Então o
 * servidor baixa e devolve.
 *
 * Uma função para os três formatos porque a diferença entre eles é o
 * caminho e o `Content-Type` — duplicar o repasse duplicaria também a
 * decisão de segurança, que é a parte que não pode divergir.
 */
export async function repassarArquivo({
  requisicao,
  caminho,
  tipo,
  nomePadrao,
}: {
  requisicao: Request;
  caminho: string;
  tipo: string;
  nomePadrao: string;
}): Promise<NextResponse> {
  const token = await lerToken();
  if (!token) {
    return NextResponse.redirect(new URL("/entrar", requisicao.url));
  }

  const pedido = new URL(requisicao.url);
  const alvo = new URL(`${baseDaApi()}${caminho}`);
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
      {
        status: resposta?.status ?? 502,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  const disposicao =
    resposta.headers.get("content-disposition") ??
    `attachment; filename="${nomePadrao}"`;

  // `arrayBuffer` e não `text`: XLSX e PDF são binários, e ler como texto
  // os corrompe.
  return new NextResponse(await resposta.arrayBuffer(), {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": disposicao,
      "Cache-Control": "no-store",
    },
  });
}
