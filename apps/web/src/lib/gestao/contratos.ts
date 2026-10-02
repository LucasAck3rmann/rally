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

export const ItemDaAgenda = z.object({
  id: z.string(),
  quadraId: z.string(),
  quadraNome: z.string(),
  inicio: z.string(),
  fim: z.string(),
  horaInicio: z.string(),
  horaFim: z.string(),
  status: z.string(),
  origem: z.string(),
  ehBloqueio: z.boolean(),
  // `null` num bloqueio: não há cobrança nem pessoa, e zero com nome em
  // branco seriam duas mentiras diferentes.
  preco: z.number().nullable(),
  motivo: z.string().nullable(),
  cliente: z
    .object({
      id: z.string(),
      nome: z.string(),
      telefone: z.string().nullish(),
    })
    .nullish(),
});
export type ItemDaAgenda = z.infer<typeof ItemDaAgenda>;

export const AgendaDoDia = z.object({
  data: z.string(),
  timezone: z.string(),
  quadras: z.array(z.object({ id: z.string(), nome: z.string() })),
  itens: z.array(ItemDaAgenda),
});
export type AgendaDoDia = z.infer<typeof AgendaDoDia>;

export const FaixaDePreco = z.object({
  id: z.string().nullish(),
  diaSemana: z.number().nullable(),
  horaInicio: z.string(),
  horaFim: z.string(),
  precoHora: z.number(),
});

export const QuadraDaGestao = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().nullish(),
  precoHora: z.number(),
  capacidade: z.number().nullish(),
  fotos: z.array(z.string()),
  comodidades: z.array(z.string()),
  modalidades: z.array(z.string()),
  faixasPreco: z.array(FaixaDePreco),
  ativo: z.boolean(),
});
export type QuadraDaGestao = z.infer<typeof QuadraDaGestao>;

export const ListaDeQuadras = z.array(QuadraDaGestao);

export const MembroDaEquipe = z.object({
  usuarioId: z.string(),
  nome: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullish(),
  papel: Papel,
  desde: z.string(),
});
export type MembroDaEquipe = z.infer<typeof MembroDaEquipe>;

export const ListaDaEquipe = z.array(MembroDaEquipe);

export const Relatorio = z.object({
  estabelecimento: z.object({ nome: z.string(), timezone: z.string() }),
  periodo: z.object({ de: z.string(), ate: z.string(), dias: z.number() }),
  resumo: z.object({
    receitaPaga: z.number(),
    receitaAReceber: z.number(),
    receitaTotal: z.number(),
    ticketMedio: z.number().nullable(),
    ocupacao: z.number().nullable(),
    horasVendidas: z.number(),
    horasDisponiveis: z.number(),
    vendidas: z.number(),
    canceladas: z.number(),
  }),
  porMetodo: z.array(
    z.object({
      metodo: z.string(),
      reservas: z.number(),
      valor: z.number(),
      participacao: z.number().nullable(),
    }),
  ),
  porDia: z.array(
    z.object({
      data: z.string(),
      reservas: z.number(),
      receita: z.number(),
      horas: z.number(),
      ocupacao: z.number().nullable(),
    }),
  ),
  porQuadra: z.array(
    z.object({
      quadraId: z.string(),
      nome: z.string(),
      reservas: z.number(),
      horas: z.number(),
      receita: z.number(),
    }),
  ),
});
export type Relatorio = z.infer<typeof Relatorio>;
