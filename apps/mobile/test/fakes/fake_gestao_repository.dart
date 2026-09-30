// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/gestao/domain/agenda.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
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
