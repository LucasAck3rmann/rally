// SPDX-License-Identifier: AGPL-3.0-or-later
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { chamarApiAutenticada, SemSessao } from "../api/autenticado";
import { ErroDeApi } from "../api/client";
import {
  CupomDaGestao,
  Mensalista,
  MensalistaCriado,
  ItemDaAgenda,
  MembroDaEquipe,
  Papel,
  QuadraDaGestao,
} from "./contratos";

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

/**
 * Move uma reserva de horário e, se preciso, de quadra (RF-21).
 *
 * Não é a remarcação do cliente: aqui quem move é a arena, e a API aceita
 * trocar de quadra e mover fora do prazo da política — os dois casos que
 * motivam a ação, quadra alagada e manutenção de urgência, acontecem em
 * cima da hora. O preço combinado não muda.
 */
export async function moverReserva(
  estabelecimentoId: string,
  reservaId: string,
  dados: { quadraId?: string; inicio: string; fim: string },
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/reservas/${reservaId}/mover`,
      ItemDaAgenda,
      { metodo: "PATCH", corpo: dados },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Cria um cupom do estabelecimento (RF-25). */
export async function criarCupom(
  estabelecimentoId: string,
  dados: {
    codigo: string;
    tipo: "PERCENTUAL" | "VALOR_FIXO";
    valor: number;
    validadeInicio: string;
    validadeFim: string;
    usosMax?: number;
  },
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/cupons`,
      CupomDaGestao,
      { metodo: "POST", corpo: dados },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

/**
 * Liga ou desliga um cupom (RF-25).
 *
 * Não existe apagar: cupom usado está apontado pela reserva, e apagá-lo
 * faria sumir de onde veio o desconto de algo que já foi pago.
 */
export async function alternarCupom(
  estabelecimentoId: string,
  cupomId: string,
  ativo: boolean,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/cupons/${cupomId}`,
      CupomDaGestao,
      { metodo: "PATCH", corpo: { ativo } },
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
export async function expirarPendentes(estabelecimentoId: string): Promise<Resultado> {
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

/**
 * Cria a série de um mensalista (RF-36, ADR-0014).
 *
 * Devolve `puladas` junto do `ok`: as semanas que colidiram com reserva já
 * existente **não** fazem a criação falhar, e o gestor precisa saber quais
 * foram. Tratar colisão como erro recusaria uma série de seis meses por causa
 * de um jogo marcado na semana que vem.
 */
export async function criarMensalista(
  estabelecimentoId: string,
  dados: {
    quadraId: string;
    /** E-mail, e não id: ninguém no painel sabe o UUID de ninguém. */
    clienteEmail: string;
    diaSemana: number;
    horaInicio: string;
    duracaoMinutos: number;
    vigenciaInicio: string;
    vigenciaFim?: string;
    preco: number;
    observacao?: string;
  },
): Promise<
  Resultado & {
    criadas?: number;
    puladas?: { data: string; motivo: string }[];
  }
> {
  try {
    const criado = await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/mensalistas`,
      MensalistaCriado,
      { metodo: "POST", corpo: dados },
    );
    recarregar(estabelecimentoId);
    // As duas contagens sobem juntas: "criei 9 semanas e pulei 1" é a frase
    // que o ADR-0014 prometeu ao gestor, e só uma das metades não a forma.
    return { ok: true, criadas: criado.criadas, puladas: criado.puladas };
  } catch (erro) {
    return comoResultado(erro);
  }
}

/**
 * Encerra a série e devolve os horários futuros para a venda.
 *
 * As ocorrências passadas ficam: são o histórico que o relatório usa para
 * fechar o mês, e apagá-las mudaria a receita de um período encerrado.
 */
export async function encerrarMensalista(
  estabelecimentoId: string,
  mensalistaId: string,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/mensalistas/${mensalistaId}`,
      Mensalista.extend({ canceladas: z.number() }),
      { metodo: "DELETE" },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}

/** Força a criação das ocorrências que faltam, sem esperar o ciclo agendado. */
export async function materializarMensalista(
  estabelecimentoId: string,
  mensalistaId: string,
): Promise<Resultado> {
  try {
    await chamarApiAutenticada(
      `/gestao/estabelecimentos/${estabelecimentoId}/mensalistas/${mensalistaId}/materializar`,
      z.object({
        criadas: z.number(),
        puladas: z.array(z.object({ data: z.string(), motivo: z.string() })),
      }),
      { metodo: "POST" },
    );
    recarregar(estabelecimentoId);
    return { ok: true };
  } catch (erro) {
    return comoResultado(erro);
  }
}
