// SPDX-License-Identifier: AGPL-3.0-or-later
import { chamarApiAutenticada } from "../api/autenticado";
import {
  AgendaDoDia,
  ListaDaEquipe,
  ListaDeEstabelecimentos,
  ListaDeQuadras,
  Painel,
} from "./contratos";

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
