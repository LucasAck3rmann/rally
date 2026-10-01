// SPDX-License-Identifier: AGPL-3.0-or-later
import { z } from "zod";

/**
 * Contratos das rotas de gestão.
 *
 * Validados na borda com Zod, como o resto do cliente: resposta fora do
 * formato é desalinhamento entre API e web, e falhar alto ali é melhor que
 * espalhar `undefined` pela árvore de componentes.
 */

export const Papel = z.enum(["ATENDENTE", "FINANCEIRO", "ADMIN", "MANTENEDOR"]);
export type Papel = z.infer<typeof Papel>;

export const EstabelecimentoGerido = z.object({
  id: z.string(),
  nome: z.string(),
  slug: z.string().nullish(),
  cidade: z.string().nullish(),
  uf: z.string().nullish(),
  plano: z.string(),
  ativo: z.boolean(),
  quadras: z.number(),
  meuPapel: Papel,
});
export type EstabelecimentoGerido = z.infer<typeof EstabelecimentoGerido>;

export const ListaDeEstabelecimentos = z.array(EstabelecimentoGerido);

export const Painel = z.object({
  periodo: z.object({ de: z.string(), ate: z.string(), dias: z.number() }),
  receita: z.object({
    paga: z.number(),
    aReceber: z.number(),
    total: z.number(),
    // `null` quando não houve venda — zero diria "o ticket é zero".
    ticketMedio: z.number().nullable(),
  }),
  ocupacao: z.object({
    percentual: z.number().nullable(),
    horasVendidas: z.number(),
    horasDisponiveis: z.number(),
  }),
  reservas: z.object({
    vendidas: z.number(),
    canceladas: z.number(),
    bloqueios: z.number(),
    taxaCancelamento: z.number().nullable(),
  }),
  porQuadra: z.array(
    z.object({
      quadraId: z.string(),
      nome: z.string(),
      reservas: z.number(),
      horasVendidas: z.number(),
      receita: z.number(),
      ocupacao: z.number().nullable(),
    }),
  ),
  proximosJogos: z.array(
    z.object({
      id: z.string(),
      quadraNome: z.string(),
      clienteNome: z.string().nullable(),
      inicio: z.string(),
      horaInicio: z.string(),
      horaFim: z.string(),
      preco: z.number(),
      status: z.string(),
      pago: z.boolean(),
    }),
  ),
});
export type Painel = z.infer<typeof Painel>;

export const Sessao = z.object({
  accessToken: z.string(),
  user: z.object({ id: z.string(), nome: z.string(), email: z.string() }),
});
