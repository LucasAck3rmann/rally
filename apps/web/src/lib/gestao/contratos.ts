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

export const CupomDaGestao = z.object({
  id: z.string(),
  codigo: z.string(),
  tipo: z.enum(["PERCENTUAL", "VALOR_FIXO"]),
  valor: z.number(),
  validadeInicio: z.string(),
  validadeFim: z.string(),
  usosMax: z.number().nullable(),
  usosFeitos: z.number(),
  ativo: z.boolean(),
  /* Estado derivado vem pronto da API: se a tela recalculasse "está
     valendo?", a lista do painel e a recusa na reserva poderiam discordar
     sobre o mesmo cupom. */
  vigente: z.boolean(),
  esgotado: z.boolean(),
  vencido: z.boolean(),
  createdAt: z.string(),
});
export type CupomDaGestao = z.infer<typeof CupomDaGestao>;

export const ListaDeCupons = z.array(CupomDaGestao);

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
  /**
   * Receita por esporte. **Os valores não somam o total**, porque uma quadra
   * pode atender mais de uma modalidade e a reserva registra a quadra, não o
   * esporte jogado — a tela diz isso embaixo da tabela.
   */
  porModalidade: z.array(
    z.object({
      modalidade: z.string(),
      reservas: z.number(),
      horas: z.number(),
      receita: z.number(),
      quadras: z.number(),
    }),
  ),
});
export type Relatorio = z.infer<typeof Relatorio>;

export const TipoDeDivergencia = z.enum([
  "PENDENTE_EXPIRADA",
  "CONFIRMADA_SEM_PAGAMENTO",
  "PAGA_NAO_CONFIRMADA",
  "CANCELADA_PAGA",
  "VALOR_DIVERGENTE",
  "SEM_COBRANCA",
]);
export type TipoDeDivergencia = z.infer<typeof TipoDeDivergencia>;

export const Gravidade = z.enum(["grave", "atencao"]);

export const Conciliacao = z.object({
  conferidas: z.number(),
  graves: z.number(),
  divergencias: z.array(
    z.object({
      tipo: TipoDeDivergencia,
      descricao: z.string(),
      gravidade: Gravidade,
      reservaId: z.string(),
      codigo: z.string(),
      quadra: z.string(),
      cliente: z.string().nullable(),
      inicio: z.string(),
      statusReserva: z.string(),
      statusPagamento: z.string().nullable(),
      valorReserva: z.number(),
      valorPagamento: z.number().nullable(),
    }),
  ),
  porTipo: z.array(
    z.object({
      tipo: TipoDeDivergencia,
      quantidade: z.number(),
      descricao: z.string(),
      gravidade: Gravidade,
    }),
  ),
});
export type Conciliacao = z.infer<typeof Conciliacao>;

/**
 * Uma linha da trilha de auditoria (RN-05).
 *
 * `autor` é nulo para ação de sistema. Hoje toda rota auditada exige token,
 * mas `autorId` é nullable no esquema e a tela precisa dizer algo em vez de
 * quebrar quando a expiração automática de Pix passar a escrever aqui.
 *
 * `dados` é o corpo enviado **já sem campo sensível**. A remoção acontece no
 * `AuditoriaInterceptor` da API e é lá que ela fica: uma segunda lista nesta
 * borda seria a quinta cópia de uma verdade neste projeto, e as quatro
 * anteriores — tokens de cor, regra de permissão, texto de campo e cópia do
 * esquema — divergiram todas antes de alguém notar.
 */
export const RegistroDaTrilha = z.object({
  id: z.string(),
  acao: z.string(),
  entidade: z.string(),
  entidadeId: z.string().nullable(),
  dados: z.unknown(),
  criadoEm: z.string(),
  autor: z.object({ id: z.string(), nome: z.string() }).nullable(),
});
export type RegistroDaTrilha = z.infer<typeof RegistroDaTrilha>;

export const TrilhaDeAuditoria = z.array(RegistroDaTrilha);
export type TrilhaDeAuditoria = z.infer<typeof TrilhaDeAuditoria>;

/**
 * Mensalista: a série semanal, não a ocorrência (RF-35, ADR-0014).
 *
 * `materializadaAte` é o campo que denuncia falha: ele diz até quando as
 * ocorrências já foram criadas, e a distância entre ele e hoje revela um
 * trabalho agendado que parou — sem ele, o horário aparece livre e ninguém
 * sabe por quê.
 */
export const Mensalista = z.object({
  id: z.string(),
  quadraId: z.string(),
  quadra: z.string(),
  clienteId: z.string(),
  cliente: z.string(),
  diaSemana: z.number(),
  horaInicio: z.string(),
  duracaoMinutos: z.number(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  preco: z.number(),
  status: z.enum(["ATIVA", "PAUSADA", "ENCERRADA"]),
  materializadaAte: z.string().nullable(),
  observacao: z.string().nullable(),
});
export type Mensalista = z.infer<typeof Mensalista>;

export const ListaDeMensalistas = z.array(Mensalista);

/** O que a criação devolve: a série e o que não coube. */
export const MensalistaCriado = Mensalista.extend({
  criadas: z.number(),
  puladas: z.array(z.object({ data: z.string(), motivo: z.string() })),
});
