// SPDX-License-Identifier: AGPL-3.0-or-later
import { NextResponse } from "next/server";

import { apagarToken } from "@/lib/auth/sessao";

/** Encerra a sessão apagando o cookie e volta para a entrada. */
export async function POST(requisicao: Request) {
  await apagarToken();
  return NextResponse.redirect(new URL("/entrar", requisicao.url), {
    // 303 porque a resposta a um POST tem de virar GET no redirecionamento;
    // com 302 alguns navegadores repetem o POST no destino.
    status: 303,
  });
}
