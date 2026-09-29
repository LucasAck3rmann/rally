// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";
import { buscarNaApi } from "./client";

/**
 * Contratos da vitrine pública, espelhando `apps/api/src/modules/quadras`.
 * O schema é a fronteira: se a API mudar de formato, quebra aqui — e não três
 * componentes adiante, com um campo indefinido na tela.
 */
export const estabelecimentoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  slug: z.string(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  nota: z.number().nullable(),
  avaliacoes: z.number(),
  descontoPixPct: z.number(),
});

export const quadraResumoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  precoHora: z.number(),
  fotos: z.array(z.string()),
  capacidade: z.number().nullable(),
  modalidades: z.array(z.string()),
  estabelecimento: estabelecimentoSchema,
  // Só a listagem traz o selo "ao vivo"; o detalhe não.
  aoVivo: z.boolean().default(false),
});

export const quadraDetalheSchema = quadraResumoSchema.extend({
  descricao: z.string().nullable(),
  comodidades: z.array(z.string()),
});

export const slotSchema = z.object({
  inicio: z.string(),
  fim: z.string(),
  hora: z.string(),
  disponivel: z.boolean(),
  preco: z.number(),
});

export const disponibilidadeSchema = z.object({
  data: z.string(),
  slotMinutos: z.number(),
  slots: z.array(slotSchema),
});

export type QuadraResumo = z.infer<typeof quadraResumoSchema>;
export type QuadraDetalhe = z.infer<typeof quadraDetalheSchema>;
export type Slot = z.infer<typeof slotSchema>;
export type Disponibilidade = z.infer<typeof disponibilidadeSchema>;

/** Modalidades da vitrine — os mesmos nomes do seed, que a API filtra por igualdade. */
export const MODALIDADES = ["Beach Tennis", "Futevôlei", "Vôlei"] as const;

export function listarQuadras(filtros: { busca?: string; modalidade?: string } = {}) {
  return buscarNaApi("/quadras", z.array(quadraResumoSchema), {
    parametros: filtros,
    revalidarEm: 30,
  });
}

export function obterQuadra(id: string) {
  return buscarNaApi(`/quadras/${encodeURIComponent(id)}`, quadraDetalheSchema, {
    revalidarEm: 60,
  });
}

/** Grade do dia (RF-07). Sem cache: um horário pode ser tomado a qualquer momento. */
export function obterDisponibilidade(id: string, data: string) {
  return buscarNaApi(`/quadras/${encodeURIComponent(id)}/disponibilidade`, disponibilidadeSchema, {
    parametros: { data },
    revalidarEm: 0,
  });
}
