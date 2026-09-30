// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "agenda.dart";
import "gestao.dart";
import "painel.dart";

/// Contrato da área de gestão (RF-02, RF-20).
abstract interface class GestaoRepository {
  /// Estabelecimentos que o usuário administra. Lista vazia = ele não
  /// gerencia nada, e a área de gestão nem aparece.
  Future<List<EstabelecimentoGerido>> meusEstabelecimentos();

  Future<List<QuadraGestao>> quadras(String estabelecimentoId);

  /// Uma quadra específica, com tudo que o formulário precisa preencher.
  Future<QuadraGestao> detalheQuadra(String estabelecimentoId, String quadraId);

  /// Cadastra uma quadra nova. Só admin — a API recusa o resto com 403.
  Future<QuadraGestao> criarQuadra(String estabelecimentoId, DadosQuadra dados);

  /// Edita uma quadra. Listas informadas **substituem** as antigas por
  /// inteiro, como manda o `AtualizarQuadraDto`.
  Future<QuadraGestao> atualizarQuadra(
    String estabelecimentoId,
    String quadraId,
    DadosQuadra dados,
  );

  /// O dia inteiro do estabelecimento, quadra a quadra (RF-21).
  Future<AgendaDoDia> agenda(String estabelecimentoId, String data);

  /// Ocupação, receita e próximos jogos dos últimos [dias] (RF-22).
  Future<Painel> painel(String estabelecimentoId, {required int dias});

  /// Tira um horário da venda. Só admin — a API recusa o resto com 403.
  Future<ItemAgenda> criarBloqueio(
    String estabelecimentoId, {
    required String quadraId,
    required DateTime inicio,
    required DateTime fim,
    String? motivo,
  });

  /// Devolve o horário para a venda.
  Future<void> removerBloqueio(String estabelecimentoId, String bloqueioId);

  /// Tira a quadra da vitrine ou devolve — sem apagar histórico.
  Future<QuadraGestao> definirAtivo(
    String estabelecimentoId,
    String quadraId, {
    required bool ativo,
  });
}
