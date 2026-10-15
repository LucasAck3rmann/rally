// SPDX-License-Identifier: AGPL-3.0-or-later
"use server";

import { z } from "zod";

import { chamarApiAutenticada, SemSessao } from "../api/autenticado";
import { ErroDeApi } from "../api/client";
import { apagarToken } from "../auth/sessao";

/**
 * Direitos do titular dos dados no painel da web (RNF-07, LGPD).
 *
 * O aplicativo já tinha a tela desde o PR #92; o painel não, e quem gerencia
 * uma arena pelo navegador não tinha como exercer o próprio direito. A lacuna
 * estava declarada na matriz — *"falta a tela equivalente no painel da web"* —
 * e é o que este arquivo fecha.
 *
 * **Isto é do titular, não do estabelecimento.** Nenhuma função aqui recebe
 * `estabelecimentoId`, e a rota não fica sob `/gestao/[estabelecimentoId]`:
 * os dados pertencem à pessoa, e pendurá-los no caminho da arena sugeriria
 * que cada arena tem uma cópia deles — além de quebrar ao trocar de arena.
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

const Exclusao = z.object({ ok: z.boolean(), anonimizadoEm: z.string() });

/** Converte a falha em texto, sem transformar sessão expirada em "erro". */
function comoResultado(erro: unknown): Resultado {
  if (erro instanceof SemSessao) {
    return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  }
  if (erro instanceof ErroDeApi) return { ok: false, erro: erro.message };
  return { ok: false, erro: "Não foi possível concluir. Tente de novo." };
}

/**
 * Elimina a conta por anonimização e encerra a sessão.
 *
 * A ordem importa: o cookie só é apagado **depois** de a API confirmar. Se a
 * sessão caísse primeiro e a exclusão falhasse — e ela falha de propósito
 * quando a pessoa é a última administradora de alguma arena —, o usuário
 * ficaria fora do painel com a conta intacta e sem ver o motivo, que é
 * justamente a parte útil da recusa.
 */
export async function excluirMinhaConta(): Promise<Resultado> {
  try {
    await chamarApiAutenticada("/privacidade/minha-conta", Exclusao, {
      metodo: "DELETE",
    });
  } catch (erro) {
    return comoResultado(erro);
  }

  // Fora do `try`: a conta já não existe, e falhar ao limpar o cookie não
  // pode virar "não foi possível excluir".
  await apagarToken();
  return { ok: true };
}
