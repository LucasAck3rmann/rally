// SPDX-License-Identifier: AGPL-3.0-or-later
import { cookies } from "next/headers";

/**
 * Sessão do painel de gestão.
 *
 * O token vive num cookie **httpOnly**: JavaScript da página não o lê, então
 * um XSS não consegue carregá-lo embora. `localStorage` seria mais simples e
 * é exatamente por isso que não serve — qualquer script na página o alcança.
 *
 * O cookie dura o mesmo que o JWT (1 dia, ver `auth.module.ts`): guardar por
 * mais tempo só trocaria "sessão expirada" por "401 inexplicável".
 */
export const COOKIE_SESSAO = "rally_sessao";

const UM_DIA_EM_SEGUNDOS = 60 * 60 * 24;

export async function lerToken(): Promise<string | null> {
  const loja = await cookies();
  return loja.get(COOKIE_SESSAO)?.value ?? null;
}

export async function gravarToken(token: string): Promise<void> {
  const loja = await cookies();
  loja.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    // `secure` só fora de desenvolvimento: em `http://localhost` o navegador
    // descarta o cookie seguro e o login falharia sem dizer por quê.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UM_DIA_EM_SEGUNDOS,
  });
}

export async function apagarToken(): Promise<void> {
  const loja = await cookies();
  loja.delete(COOKIE_SESSAO);
}
