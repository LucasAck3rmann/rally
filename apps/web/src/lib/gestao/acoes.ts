// SPDX-License-Identifier: AGPL-3.0-or-later
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { chamarApiAutenticada, SemSessao } from "../api/autenticado";
import { ErroDeApi } from "../api/client";
import { ItemDaAgenda, MembroDaEquipe, Papel, QuadraDaGestao } from "./contratos";

/**
 * Escritas do painel da web.
 *
 * Toda ação roda **no servidor**: o token está num cookie httpOnly, que o
 * JavaScript da página não lê. É o que permite a web escrever sem expor a
 * sessão — e é também por que não há como fazer isso de um componente
 * cliente.
 *
 * Nenhuma destas funções confere papel. **A autorização é do servidor**: o
 * `PapelGuard` responde 403 e a mensagem dele chega ao usuário. Reproduzir a
 * regra aqui criaria uma segunda verdade para desalinhar — a interface
 * esconde o que o servidor recusaria, mas não é ela que decide.
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

/** Converte a falha em texto, sem transformar sessão expirada em "erro". */
function comoResultado(erro: unknown): Resultado {
  if (erro instanceof SemSessao) {
    return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  }
  if (erro instanceof ErroDeApi) return { ok: false, erro: erro.message };
  return { ok: false, erro: "Não foi possível concluir. Tente de novo." };
}

/**
 * Recarrega os dados do estabelecimento depois de uma escrita.
 *
 * `layout` e não `page`: a barra lateral mostra a contagem de quadras, e
 * revalidar só a página deixaria o número velho ao lado do dado novo.
 */
function recarregar(estabelecimentoId: string) {
  revalidatePath(`/gestao/${estabelecimentoId}`, "layout");
}

export async function pausarQuadra(
  estabelecimentoId: string,
  quadraId: string,
  ativo: boolean,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/quadras/${quadraId}`,
      QuadraDaGestao,
      { metodo: "PATCH", corpo: { ativo } },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function bloquearHorario(
  estabelecimentoId: string,
  dados: { quadraId: string; inicio: string; fim: string; motivo?: string },
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/bloqueios`,
      ItemDaAgenda,
      { metodo: "POST", corpo: dados },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function liberarHorario(
  estabelecimentoId: string,
  bloqueioId: string,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/bloqueios/${bloqueioId}`,
      z.unknown(),
      { metodo: "DELETE" },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function adicionarMembro(
  estabelecimentoId: string,
  dados: { email: string; papel: Papel },
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/equipe`,
      MembroDaEquipe,
      { metodo: "POST", corpo: dados },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function trocarPapel(
  estabelecimentoId: string,
  usuarioId: string,
  papel: Papel,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/equipe/${usuarioId}`,
      MembroDaEquipe,
      { metodo: "PATCH", corpo: { papel } },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

export async function tirarDaEquipe(
  estabelecimentoId: string,
  usuarioId: string,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/equipe/${usuarioId}`,
      z.unknown(),
      { metodo: "DELETE" },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

/**
 * Libera os horários cujo Pix expirou (RN-13).
 *
 * A grade já faz isso de forma preguiçosa a cada leitura; esta ação existe
 * para o dono resolver a lista inteira de uma vez, sem depender de alguém
 * abrir a agenda de cada quadra.
 */
export async function expirarPendentes(
  estabelecimentoId: string,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/conciliacao/expirar-pendentes`,
      z.object({ liberadas: z.number() }),
      { metodo: "POST" },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}
