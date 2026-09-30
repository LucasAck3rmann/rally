// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

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
