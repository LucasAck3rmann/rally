// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/gestao/domain/agenda.dart";
import "package:rally_mobile/features/gestao/domain/equipe.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
import "package:rally_mobile/features/gestao/domain/painel.dart";
import "package:rally_mobile/features/gestao/domain/gestao_repository.dart";

/// Vínculo de mentira.
EstabelecimentoGerido estabelecimentoFalso({
  String id = "e1",
  String nome = "Arena Beach Sapiranga",
  int quadras = 2,
  PapelGestao papel = PapelGestao.admin,
}) {
  return EstabelecimentoGerido(
    id: id,
    nome: nome,
    plano: "PRO",
    ativo: true,
    quadras: quadras,
    meuPapel: papel,
    cidade: "Sapiranga",
    uf: "RS",
  );
}

/// Quadra de mentira, na visão do dono.
QuadraGestao quadraFalsa({
  String id = "q1",
  String nome = "Quadra 1",
  double precoHora = 120,
  bool ativo = true,
  List<String> modalidades = const ["Beach tennis"],
  int faixas = 0,
}) {
  return QuadraGestao(
    id: id,
    nome: nome,
    precoHora: precoHora,
    ativo: ativo,
    modalidades: modalidades,
    fotos: const [],
    comodidades: const [],
    faixasPreco: [
      for (var i = 0; i < faixas; i++)
        FaixaPreco(
          id: "f$i",
          diaSemana: i,
          horaInicio: "18:00",
          horaFim: "22:00",
          precoHora: precoHora + 20,
        ),
    ],
  );
}

/// Guarda o estado em memória: `definirAtivo` altera a lista devolvida
/// depois, que é justamente o que a tela relê ao invalidar o provedor.
class FakeGestaoRepository implements GestaoRepository {
  FakeGestaoRepository({
    List<EstabelecimentoGerido>? estabelecimentos,
    List<QuadraGestao>? quadras,
  })  : estabelecimentos = estabelecimentos ?? [estabelecimentoFalso()],
        _quadras = quadras ?? [quadraFalsa()];

  List<EstabelecimentoGerido> estabelecimentos;
  List<QuadraGestao> _quadras;

  /// Chamadas de pausa/reativação recebidas, na ordem: (quadra, ativo).
  final List<(String, bool)> alteracoes = [];

  /// Quando definido, a próxima escrita falha com este erro.
  Object? erroAoSalvar;

  @override
  Future<List<EstabelecimentoGerido>> meusEstabelecimentos() async =>
      estabelecimentos;

  @override
  Future<List<QuadraGestao>> quadras(String estabelecimentoId) async =>
      _quadras;

  /// Payloads recebidos por `criarQuadra`/`atualizarQuadra`, na ordem — é
  /// assim que o teste confere o que o formulário mandou, e não só o que
  /// ele desenhou na tela.
  final List<DadosQuadra> salvos = [];

  /// Agenda devolvida por `agenda()`. Cada teste monta a sua.
  AgendaDoDia? agendaDoDia;

  /// Bloqueios criados, na ordem: (quadra, hora de início, motivo).
  final List<(String, int, String?)> bloqueios = [];

  /// Ids passados para `removerBloqueio`.
  final List<String> liberados = [];

  /// Painel devolvido por `painel()`. Cada teste monta o seu.
  Painel? painelDoPeriodo;

  /// Períodos pedidos, na ordem — é assim que o teste confere que o chip
  /// escolhido chegou até a consulta, e não só mudou de cor.
  final List<int> periodos = [];

  /// Equipe devolvida por `equipe()`.
  List<MembroEquipe>? equipeDoLugar;

  /// Convites pedidos, na ordem: (email, papel).
  final List<(String, PapelGestao)> convites = [];

  /// Trocas de papel pedidas: (usuário, papel).
  final List<(String, PapelGestao)> trocas = [];

  /// Ids tirados da equipe.
  final List<String> retirados = [];

  @override
  Future<List<MembroEquipe>> equipe(String estabelecimentoId) async {
    return equipeDoLugar ?? [membroFalso()];
  }

  @override
  Future<MembroEquipe> adicionarMembro(
    String estabelecimentoId, {
    required String email,
    required PapelGestao papel,
  }) async {
    convites.add((email, papel));
    if (erroAoSalvar != null) throw erroAoSalvar!;
    final novo = membroFalso(
      usuarioId: "u${convites.length + 1}",
      nome: "Novo Membro",
      email: email,
      papel: papel,
    );
    equipeDoLugar = [...?equipeDoLugar, novo];
    return novo;
  }

  @override
  Future<MembroEquipe> trocarPapel(
    String estabelecimentoId,
    String usuarioId,
    PapelGestao papel,
  ) async {
    trocas.add((usuarioId, papel));
    if (erroAoSalvar != null) throw erroAoSalvar!;
    return membroFalso(usuarioId: usuarioId, papel: papel);
  }

  @override
  Future<void> removerMembro(
    String estabelecimentoId,
    String usuarioId,
  ) async {
    retirados.add(usuarioId);
    if (erroAoSalvar != null) throw erroAoSalvar!;
    equipeDoLugar =
        equipeDoLugar?.where((m) => m.usuarioId != usuarioId).toList();
  }

  @override
  Future<Painel> painel(String estabelecimentoId, {required int dias}) async {
    periodos.add(dias);
    if (erroAoSalvar != null) throw erroAoSalvar!;
    return painelDoPeriodo ?? painelFalso(dias: dias);
  }

  @override
  Future<AgendaDoDia> agenda(String estabelecimentoId, String data) async {
    return agendaDoDia ??
        AgendaDoDia(
          data: data,
          timezone: "America/Sao_Paulo",
          quadras: const [QuadraDaAgenda(id: "q1", nome: "Quadra 1")],
          itens: const [],
        );
  }

  @override
  Future<ItemAgenda> criarBloqueio(
    String estabelecimentoId, {
    required String quadraId,
    required DateTime inicio,
    required DateTime fim,
    String? motivo,
  }) async {
    bloqueios.add((quadraId, inicio.hour, motivo));
    if (erroAoSalvar != null) throw erroAoSalvar!;
    final novo = itemDeAgendaFalso(
      id: "b${bloqueios.length}",
      quadraId: quadraId,
      hora: inicio.hour,
      ehBloqueio: true,
      motivo: motivo,
    );
    agendaDoDia = _com(novo);
    return novo;
  }

  @override
  Future<void> removerBloqueio(
    String estabelecimentoId,
    String bloqueioId,
  ) async {
    liberados.add(bloqueioId);
    if (erroAoSalvar != null) throw erroAoSalvar!;
    final atual = agendaDoDia;
    if (atual != null) {
      agendaDoDia = AgendaDoDia(
        data: atual.data,
        timezone: atual.timezone,
        quadras: atual.quadras,
        itens: atual.itens.where((i) => i.id != bloqueioId).toList(),
      );
    }
  }

  AgendaDoDia _com(ItemAgenda item) {
    final atual = agendaDoDia;
    return AgendaDoDia(
      data: atual?.data ?? "2026-10-05",
      timezone: atual?.timezone ?? "America/Sao_Paulo",
      quadras:
          atual?.quadras ?? const [QuadraDaAgenda(id: "q1", nome: "Quadra 1")],
      itens: [...?atual?.itens, item],
    );
  }

  @override
  Future<QuadraGestao> detalheQuadra(
    String estabelecimentoId,
    String quadraId,
  ) async {
    return _quadras.firstWhere((q) => q.id == quadraId);
  }

  @override
  Future<QuadraGestao> criarQuadra(
    String estabelecimentoId,
    DadosQuadra dados,
  ) async {
    salvos.add(dados);
    if (erroAoSalvar != null) throw erroAoSalvar!;
    final nova = _daDados("q${_quadras.length + 1}", dados, ativo: true);
    _quadras = [..._quadras, nova];
    return nova;
  }

  @override
  Future<QuadraGestao> atualizarQuadra(
    String estabelecimentoId,
    String quadraId,
    DadosQuadra dados,
  ) async {
    salvos.add(dados);
    if (erroAoSalvar != null) throw erroAoSalvar!;
    final antiga = _quadras.firstWhere((q) => q.id == quadraId);
    final nova = _daDados(quadraId, dados, ativo: antiga.ativo);
    _quadras = [
      for (final q in _quadras)
        if (q.id == quadraId) nova else q,
    ];
    return nova;
  }

  QuadraGestao _daDados(String id, DadosQuadra d, {required bool ativo}) {
    return QuadraGestao(
      id: id,
      nome: d.nome,
      precoHora: d.precoHora,
      ativo: ativo,
      modalidades: d.modalidades,
      fotos: const [],
      comodidades: d.comodidades,
      faixasPreco: d.faixasPreco,
      descricao: d.descricao,
      capacidade: d.capacidade,
    );
  }

  @override
  Future<QuadraGestao> definirAtivo(
    String estabelecimentoId,
    String quadraId, {
    required bool ativo,
  }) async {
    alteracoes.add((quadraId, ativo));
    if (erroAoSalvar != null) throw erroAoSalvar!;

    final antiga = _quadras.firstWhere((q) => q.id == quadraId);
    final nova = QuadraGestao(
      id: antiga.id,
      nome: antiga.nome,
      precoHora: antiga.precoHora,
      ativo: ativo,
      modalidades: antiga.modalidades,
      fotos: antiga.fotos,
      comodidades: antiga.comodidades,
      faixasPreco: antiga.faixasPreco,
      descricao: antiga.descricao,
      capacidade: antiga.capacidade,
    );
    _quadras = [
      for (final q in _quadras)
        if (q.id == quadraId) nova else q,
    ];
    return nova;
  }
}

/// Item de agenda de mentira, de uma hora cheia.
ItemAgenda itemDeAgendaFalso({
  String id = "a1",
  String quadraId = "q1",
  String quadraNome = "Quadra 1",
  int hora = 19,
  int duracaoHoras = 1,
  bool ehBloqueio = false,
  String? motivo,
  String? clienteNome = "Lucas",
  double? preco = 80,
}) {
  final inicio = DateTime(2026, 10, 5, hora);
  return ItemAgenda(
    id: id,
    quadraId: quadraId,
    quadraNome: quadraNome,
    inicio: inicio,
    fim: inicio.add(Duration(hours: duracaoHoras)),
    horaInicio: "${hora.toString().padLeft(2, "0")}:00",
    horaFim: "${(hora + duracaoHoras).toString().padLeft(2, "0")}:00",
    status: ehBloqueio ? "BLOQUEIO" : "CONFIRMADA",
    ehBloqueio: ehBloqueio,
    preco: ehBloqueio ? null : preco,
    motivo: ehBloqueio ? motivo : null,
    clienteNome: ehBloqueio ? null : clienteNome,
  );
}

/// Agenda de mentira com os itens informados.
AgendaDoDia agendaFalsa({
  List<ItemAgenda> itens = const [],
  List<QuadraDaAgenda> quadras = const [
    QuadraDaAgenda(id: "q1", nome: "Quadra 1"),
    QuadraDaAgenda(id: "q2", nome: "Quadra 2"),
  ],
  String data = "2026-10-05",
}) {
  return AgendaDoDia(
    data: data,
    timezone: "America/Sao_Paulo",
    quadras: quadras,
    itens: itens,
  );
}

/// Painel de mentira. Os padrões descrevem uma semana com movimento.
Painel painelFalso({
  int dias = 7,
  double paga = 800,
  double aReceber = 240,
  double? ticketMedio = 130,
  double? ocupacao = 42.5,
  double horasVendidas = 8,
  double horasDisponiveis = 98,
  int vendidas = 8,
  int canceladas = 1,
  int bloqueios = 2,
  double? taxaCancelamento = 11.1,
  List<QuadraNoPainel>? quadras,
  List<ProximoJogo>? proximosJogos,
}) {
  return Painel(
    dias: dias,
    de: "2026-09-24",
    ate: "2026-09-30",
    receita: ReceitaPainel(
      paga: paga,
      aReceber: aReceber,
      total: paga + aReceber,
      ticketMedio: ticketMedio,
    ),
    ocupacao: OcupacaoPainel(
      horasVendidas: horasVendidas,
      horasDisponiveis: horasDisponiveis,
      percentual: ocupacao,
    ),
    contagem: ContagemPainel(
      vendidas: vendidas,
      canceladas: canceladas,
      bloqueios: bloqueios,
      taxaCancelamento: taxaCancelamento,
    ),
    quadras: quadras ??
        const [
          QuadraNoPainel(
            quadraId: "q1",
            nome: "Quadra 1",
            reservas: 6,
            horasVendidas: 6,
            receita: 640,
            ocupacao: 40,
          ),
          QuadraNoPainel(
            quadraId: "q2",
            nome: "Quadra 2",
            reservas: 2,
            horasVendidas: 2,
            receita: 400,
            ocupacao: 13.3,
          ),
        ],
    proximosJogos: proximosJogos ??
        [
          ProximoJogo(
            id: "j1",
            quadraNome: "Quadra 1",
            inicio: DateTime(2026, 10, 1, 19),
            horaInicio: "19:00",
            horaFim: "20:00",
            preco: 80,
            pago: true,
            clienteNome: "Augusto Boff",
          ),
          ProximoJogo(
            id: "j2",
            quadraNome: "Quadra 2",
            inicio: DateTime(2026, 10, 1, 20),
            horaInicio: "20:00",
            horaFim: "21:00",
            preco: 120,
            pago: false,
          ),
        ],
  );
}

/// Membro de equipe de mentira.
MembroEquipe membroFalso({
  String usuarioId = "u2",
  String nome = "Augusto Boff",
  String email = "augusto@rally.com.br",
  PapelGestao papel = PapelGestao.atendente,
}) {
  return MembroEquipe(
    usuarioId: usuarioId,
    nome: nome,
    email: email,
    papel: papel,
    desde: DateTime(2026, 9, 1),
  );
}
