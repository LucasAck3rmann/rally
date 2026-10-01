// SPDX-License-Identifier: AGPL-3.0-or-later
import { chamarApiAutenticada } from "../api/autenticado";
import { ListaDeEstabelecimentos, Painel } from "./contratos";

/** O que o usuário administra — alimenta o seletor da barra lateral. */
export function meusEstabelecimentos() {
  return chamarApiAutenticada("/gestao/estabelecimentos", ListaDeEstabelecimentos);
}

export function painelDoEstabelecimento(estabelecimentoId: string, dias: number) {
  return chamarApiAutenticada(
    `/gestao/estabelecimentos/${estabelecimentoId}/painel`,
    Painel,
    { parametros: { dias } },
  );
}
