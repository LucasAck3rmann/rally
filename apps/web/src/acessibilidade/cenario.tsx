// SPDX-License-Identifier: AGPL-3.0-or-later
import { render } from "@testing-library/react";

import { BarraLateral } from "@/components/gestao/barra-lateral";
import { CuponsDaArena } from "@/components/gestao/cupons";
import { EquipeDaArena } from "@/components/gestao/equipe";
import { Privacidade } from "@/components/gestao/privacidade";
import { FormularioDeConvite } from "@/components/gestao/formulario-de-convite";
import { FormularioDeCupom } from "@/components/gestao/formulario-de-cupom";
import { FormularioDeEntrada } from "@/components/gestao/formulario-de-entrada";
import { FormularioDeRecuperacao } from "@/components/gestao/formulario-de-recuperacao";
import { FormularioDeRedefinicao } from "@/components/gestao/formulario-de-redefinicao";
import { AgendaDaArena } from "@/components/gestao/agenda";
import { ConciliacaoDaArena } from "@/components/gestao/conciliacao";
import { MensalistasDaArena } from "@/components/gestao/mensalistas";
import { PainelDaArena } from "@/components/gestao/painel";
import { QuadrasDaArena } from "@/components/gestao/quadras";
import { RelatorioDaArena } from "@/components/gestao/relatorio";
import { TrilhaDaArena } from "@/components/gestao/trilha";
import { Filtros } from "@/components/quadras/filtros";
import type {
  AgendaDoDia,
  Conciliacao,
  CupomDaGestao,
  EstabelecimentoGerido,
  MembroDaEquipe,
  Mensalista,
  Painel,
  QuadraDaGestao,
  RegistroDaTrilha,
  Relatorio,
} from "@/lib/gestao/contratos";

/**
 * **Cenário comum dos portões de acessibilidade da web (RNF-08).**
 *
 * Equivalente do `test/acessibilidade/cenario.dart` do aplicativo. Existe para
 * que as três suítes — contraste, alvo de toque e nome acessível — percorram
 * **a mesma lista de telas**: um portão que cada suíte alimenta por conta
 * própria acaba cobrindo três conjuntos diferentes, e o que falta em um não
 * aparece em nenhum.
 *
 * **O que esta lista cobre, e o que não cobre.** Cobre as telas com
 * **controle de formulário** — onde rótulo, nome acessível e tamanho de alvo
 * decidem se a pessoa consegue operar o sistema — e a **barra lateral**, que
 * é o único controle presente em toda navegação do painel. Não cobre a
 * *landing*, que é texto e imagem, nem o painel e a conciliação, que são
 * tabelas de leitura sem entrada de dados. Tela nova com campo ou botão
 * **entra aqui**; é o único jeito de a lista continuar dizendo a verdade.
 *
 * A trilha de auditoria entrou por essa regra, e vale dizer por quê: ela é
 * tabela de leitura como o painel, mas tem **barra de filtro** — caixa de
 * busca, seletor e botão. O critério é o controle, não o tipo de tela.
 *
 * A barra lateral entrou depois, e vale registrar por quê: o botão "Sair"
 * tinha **cerca de 33 px** e passou pelo portão de alvo de toque porque a
 * barra não estava nesta lista. Quem escreve o portão também esquece de
 * alimentá-lo — por isso o aviso acima está em negrito.
 *
 * Os painéis que **abrem ao clique** (o formulário de cupom, por exemplo) são
 * percorridos no estado fechado: os campos que só existem depois do clique
 * ficam fora. É um furo conhecido e declarado, não uma omissão.
 */
export type Cenario = {
  /** Como a tela aparece na mensagem de falha. */
  nome: string;
  montar: () => void;
};

function quadra(opcoes: Partial<QuadraDaGestao> = {}): QuadraDaGestao {
  return {
    id: "q1",
    nome: "Quadra 1",
    descricao: null,
    precoHora: 80,
    capacidade: 4,
    fotos: [],
    comodidades: ["Vestiário"],
    modalidades: ["Beach Tennis"],
    faixasPreco: [],
    ativo: true,
    ...opcoes,
  };
}

function membro(opcoes: Partial<MembroDaEquipe> = {}): MembroDaEquipe {
  return {
    usuarioId: "u2",
    nome: "Augusto Boff",
    email: "augusto@rally.com.br",
    avatarUrl: null,
    papel: "ATENDENTE",
    desde: "2026-09-01T12:00:00.000Z",
    ...opcoes,
  };
}

function cupom(opcoes: Partial<CupomDaGestao> = {}): CupomDaGestao {
  return {
    id: "c1",
    codigo: "BORAJOGAR",
    tipo: "PERCENTUAL",
    valor: 20,
    validadeInicio: "2026-10-01T00:00:00.000Z",
    validadeFim: "2026-11-30T23:59:59.000Z",
    usosMax: 200,
    usosFeitos: 3,
    ativo: true,
    vigente: true,
    esgotado: false,
    vencido: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...opcoes,
  };
}

function registroDaTrilha(opcoes: Partial<RegistroDaTrilha> = {}): RegistroDaTrilha {
  return {
    id: "a1",
    acao: "pausar quadra",
    entidade: "Quadra",
    entidadeId: "q1",
    dados: { ativo: false },
    criadoEm: "2026-10-15T13:00:00.000Z",
    autor: { id: "u1", nome: "Lucas Ackermann" },
    ...opcoes,
  };
}

function arena(opcoes: Partial<EstabelecimentoGerido> = {}): EstabelecimentoGerido {
  return {
    id: "e1",
    nome: "Arena Beira-Rio",
    slug: "arena-beira-rio",
    cidade: "Sapiranga",
    uf: "RS",
    plano: "PRO",
    ativo: true,
    quadras: 3,
    meuPapel: "ADMIN",
    ...opcoes,
  };
}

const RELATORIO: Relatorio = {
  estabelecimento: { nome: "Arena Beach Sapiranga", timezone: "America/Sao_Paulo" },
  periodo: { de: "2026-09-10", ate: "2026-09-12", dias: 3 },
  resumo: {
    receitaPaga: 800,
    receitaAReceber: 240,
    receitaTotal: 1040,
    ticketMedio: 130,
    ocupacao: 42.5,
    horasVendidas: 8,
    horasDisponiveis: 42,
    vendidas: 8,
    canceladas: 1,
  },
  porMetodo: [
    { metodo: "Pix", reservas: 6, valor: 800, participacao: 76.9 },
    { metodo: "Balcão", reservas: 2, valor: 240, participacao: 23.1 },
  ],
  porDia: [
    { data: "2026-09-10", reservas: 4, receita: 640, horas: 4, ocupacao: 28.6 },
    { data: "2026-09-11", reservas: 0, receita: 0, horas: 0, ocupacao: 0 },
    { data: "2026-09-12", reservas: 4, receita: 400, horas: 4, ocupacao: 28.6 },
  ],
  porQuadra: [{ quadraId: "q1", nome: "Quadra 1", reservas: 6, horas: 6, receita: 640 }],
  porModalidade: [
    { modalidade: "Beach Tennis", reservas: 6, horas: 6, receita: 640, quadras: 2 },
    { modalidade: "Futevôlei", reservas: 2, horas: 2, receita: 240, quadras: 1 },
  ],
};

const AGENDA: AgendaDoDia = {
  data: "2026-09-10",
  timezone: "America/Sao_Paulo",
  quadras: [{ id: "q1", nome: "Quadra 1" }],
  itens: [
    {
      id: "r1",
      quadraId: "q1",
      quadraNome: "Quadra 1",
      inicio: "2026-09-10T22:00:00.000Z",
      fim: "2026-09-10T23:00:00.000Z",
      horaInicio: "19:00",
      horaFim: "20:00",
      status: "CONFIRMADA",
      origem: "APP",
      ehBloqueio: false,
      preco: 80,
      motivo: null,
      cliente: { id: "u1", nome: "Augusto Boff" },
    },
    // Um bloqueio ao lado da reserva: as duas células desenham controles
    // diferentes, e um cenário com só uma delas veria metade dos botões.
    {
      id: "b1",
      quadraId: "q1",
      quadraNome: "Quadra 1",
      inicio: "2026-09-10T23:00:00.000Z",
      fim: "2026-09-11T00:00:00.000Z",
      horaInicio: "20:00",
      horaFim: "21:00",
      status: "BLOQUEIO",
      origem: "BALCAO",
      ehBloqueio: true,
      preco: null,
      motivo: "manutenção da rede",
      cliente: null,
    },
  ],
};

const PAINEL: Painel = {
  periodo: { de: "2026-09-04", ate: "2026-09-10", dias: 7 },
  receita: { paga: 800, aReceber: 240, total: 1040, ticketMedio: 130 },
  ocupacao: { percentual: 42.5, horasVendidas: 8, horasDisponiveis: 42 },
  reservas: { vendidas: 8, canceladas: 1, bloqueios: 2, taxaCancelamento: 11.1 },
  porQuadra: [
    {
      quadraId: "q1",
      nome: "Quadra 1",
      reservas: 6,
      horasVendidas: 6,
      receita: 640,
      ocupacao: 42.5,
    },
  ],
  proximosJogos: [
    {
      id: "r1",
      quadraNome: "Quadra 1",
      clienteNome: "Augusto Boff",
      inicio: "2026-09-10T22:00:00.000Z",
      horaInicio: "19:00",
      horaFim: "20:00",
      preco: 80,
      status: "CONFIRMADA",
      pago: true,
    },
  ],
};

const CONCILIACAO: Conciliacao = {
  conferidas: 12,
  graves: 1,
  divergencias: [
    {
      tipo: "PENDENTE_EXPIRADA",
      descricao: "Pix expirado e horário ainda preso",
      gravidade: "grave",
      reservaId: "r9",
      codigo: "RLY-0009",
      quadra: "Quadra 1",
      cliente: "Augusto Boff",
      inicio: "2026-09-09T22:00:00.000Z",
      statusReserva: "PENDENTE",
      statusPagamento: "EXPIRADO",
      valorReserva: 80,
      valorPagamento: 80,
    },
  ],
  porTipo: [
    {
      tipo: "PENDENTE_EXPIRADA",
      quantidade: 1,
      descricao: "Pix expirado e horário ainda preso",
      gravidade: "grave",
    },
  ],
};

function mensalista(opcoes: Partial<Mensalista> = {}): Mensalista {
  return {
    id: "s1",
    quadraId: "q1",
    quadra: "Quadra 1",
    clienteId: "u1",
    cliente: "Augusto Boff",
    diaSemana: 2,
    horaInicio: "19:00",
    duracaoMinutos: 60,
    vigenciaInicio: "2026-09-01",
    vigenciaFim: null,
    preco: 90,
    status: "ATIVA",
    materializadaAte: "2026-11-10",
    observacao: null,
    ...opcoes,
  };
}

/**
 * As telas percorridas pelos portões.
 *
 * Os componentes de gestão são montados com `podeEditar` **verdadeiro** de
 * propósito: é o estado que desenha os botões de escrita, e um portão que
 * rodasse só na visão de leitura não veria nenhum deles.
 */
export const CENARIOS: Cenario[] = [
  {
    nome: "entrar",
    montar: () => render(<FormularioDeEntrada />),
  },
  {
    nome: "recuperar senha",
    montar: () => render(<FormularioDeRecuperacao />),
  },
  {
    nome: "redefinir senha",
    montar: () => render(<FormularioDeRedefinicao token="t1" />),
  },
  {
    nome: "buscar quadras (filtros)",
    montar: () => render(<Filtros busca="beach" modalidade="Beach Tennis" />),
  },
  {
    // As quatro telas abaixo entraram em 19/10, depois que a medida no
    // navegador achou um controle de 40,8 x 16,5 px na agenda que nenhum
    // portao via: a agenda nao estava nesta lista, e a ancora do portao
    // media **tamanho** (`total > 20`) em vez de **correspondencia**.
    nome: "gestão · painel",
    montar: () =>
      render(
        <PainelDaArena painel={PAINEL} dias={7} periodos={[7, 30, 90]} estabelecimentoId="e1" />,
      ),
  },
  {
    nome: "gestão · agenda",
    montar: () =>
      render(
        <AgendaDaArena
          agenda={AGENDA}
          dias={["2026-09-10", "2026-09-11"]}
          estabelecimentoId="e1"
          podeBloquear
        />,
      ),
  },
  {
    nome: "gestão · mensalistas",
    montar: () =>
      render(
        <MensalistasDaArena
          mensalistas={[mensalista(), mensalista({ id: "s2", status: "ENCERRADA" })]}
          quadras={[quadra()]}
          estabelecimentoId="e1"
          hoje="2026-09-10"
          podeEditar
        />,
      ),
  },
  {
    nome: "gestão · conciliação",
    montar: () =>
      render(<ConciliacaoDaArena conciliacao={CONCILIACAO} estabelecimentoId="e1" podeExpirar />),
  },
  {
    nome: "gestão · quadras",
    montar: () =>
      render(
        <QuadrasDaArena
          quadras={[quadra(), quadra({ id: "q2", nome: "Quadra 2", ativo: false })]}
          estabelecimentoId="e1"
          podeEditar
        />,
      ),
  },
  {
    nome: "gestão · equipe",
    montar: () =>
      render(
        <EquipeDaArena
          equipe={[membro(), membro({ usuarioId: "u3", papel: "ADMIN" })]}
          estabelecimentoId="e1"
          podeEditar
        />,
      ),
  },
  {
    nome: "gestão · convidar membro",
    montar: () => render(<FormularioDeConvite estabelecimentoId="e1" />),
  },
  {
    nome: "gestão · cupons",
    montar: () =>
      render(
        <CuponsDaArena
          cupons={[cupom(), cupom({ id: "c2", codigo: "PRIMEIRAVEZ", ativo: false })]}
          estabelecimentoId="e1"
          podeEditar
        />,
      ),
  },
  {
    nome: "gestão · novo cupom",
    montar: () => render(<FormularioDeCupom estabelecimentoId="e1" />),
  },
  {
    nome: "conta · privacidade",
    montar: () => render(<Privacidade email="lucas@arena.com.br" />),
  },
  {
    // Com duas arenas, para que o seletor de estabelecimento também apareça.
    nome: "barra lateral do painel",
    montar: () =>
      render(
        <BarraLateral
          estabelecimentos={[
            arena(),
            arena({ id: "e2", nome: "Arena Sapiranga", meuPapel: "ATENDENTE" }),
          ]}
        />,
      ),
  },
  {
    // Com duas entidades, para o seletor ter mais de uma opção, e no teto do
    // limite, para o link "ver 500" também ser percorrido.
    nome: "gestão · auditoria",
    montar: () =>
      render(
        <TrilhaDaArena
          trilha={[
            registroDaTrilha(),
            registroDaTrilha({
              id: "a2",
              acao: "expirar pendentes",
              entidade: "Pagamento",
              entidadeId: null,
              autor: null,
            }),
          ]}
          estabelecimentoId="e1"
          filtro={{ busca: "pausar" }}
          teto={2}
        />,
      ),
  },
  {
    nome: "gestão · relatórios",
    montar: () =>
      render(
        <RelatorioDaArena
          relatorio={RELATORIO}
          estabelecimentoId="e1"
          urlDoCsv="/gestao/e1/relatorios/csv"
          urlDoXlsx="/gestao/e1/relatorios/xlsx"
          urlDoPdf="/gestao/e1/relatorios/pdf"
        />,
      ),
  },
];
