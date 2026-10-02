// SPDX-License-Identifier: AGPL-3.0-or-later
import { cache } from "react";

import { chamarApiAutenticada } from "../api/autenticado";
import {
  AgendaDoDia,
  ListaDaEquipe,
  ListaDeEstabelecimentos,
  ListaDeQuadras,
  Painel,
  Relatorio,
} from "./contratos";

/**
 * O que o usuário administra — alimenta o seletor da barra lateral e a
 * decisão de quais botões a página mostra.
 *
 * Em `cache()` porque o layout **e** a página precisam dela na mesma
 * renderização: sem isso, cada navegação faria duas chamadas idênticas.
 */
export const meusEstabelecimentos = cache(() =>
  chamarApiAutenticada("/gestao/estabelecimentos", ListaDeEstabelecimentos),
);

/** O papel do usuário num estabelecimento, ou `null` se ele não tem vínculo. */
export async function meuPapelEm(estabelecimentoId: string) {
  const lista = await meusEstabelecimentos();
  return lista.find((e) => e.id === estabelecimentoId)?.meuPapel ?? null;
}

export function painelDoEstabelecimento(estabelecimentoId: string, dias: number) {
  return chamarApiAutenticada(
    `/gestao/estabelecimentos/${estabelecimentoId}/painel`,
    Painel,
    { parametros: { dias } },
  );
}

export function agendaDoDia(estabelecimentoId: string, data: string) {
  return chamarApiAutenticada(
    `/gestao/estabelecimentos/${estabelecimentoId}/agenda`,
    AgendaDoDia,
    { parametros: { data } },
  );
}

export function quadrasDoEstabelecimento(estabelecimentoId: string) {
  return chamarApiAutenticada(
    `/gestao/estabelecimentos/${estabelecimentoId}/quadras`,
    ListaDeQuadras,
  );
}

export function equipeDoEstabelecimento(estabelecimentoId: string) {
  return chamarApiAutenticada(
    `/gestao/estabelecimentos/${estabelecimentoId}/equipe`,
    ListaDaEquipe,
  );
}

export function relatorioDoPeriodo(
  estabelecimentoId: string,
  de: string,
  ate: string,
) {
  return chamarApiAutenticada(
    `/gestao/estabelecimentos/${estabelecimentoId}/relatorios`,
    Relatorio,
    { parametros: { de, ate } },
  );
}
