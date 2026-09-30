// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "gestao.dart";

/// Contrato da área de gestão (RF-02, RF-20).
abstract interface class GestaoRepository {
  /// Estabelecimentos que o usuário administra. Lista vazia = ele não
  /// gerencia nada, e a área de gestão nem aparece.
  Future<List<EstabelecimentoGerido>> meusEstabelecimentos();

  Future<List<QuadraGestao>> quadras(String estabelecimentoId);

  /// Tira a quadra da vitrine ou devolve — sem apagar histórico.
  Future<QuadraGestao> definirAtivo(
    String estabelecimentoId,
    String quadraId, {
    required bool ativo,
  });
}
