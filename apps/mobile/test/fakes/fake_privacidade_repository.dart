// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "dart:async";

import "package:rally_mobile/features/privacidade/domain/privacidade_repository.dart";

/// Repositório de privacidade de mentira para os testes de widget.
class FakePrivacidadeRepository implements PrivacidadeRepository {
  /// Erro lançado pela próxima chamada, quando definido.
  PrivacidadeException? erroDeExportacao;
  PrivacidadeException? erroDeExclusao;

  /// Quando `true`, a chamada fica pendente para sempre.
  bool exportacaoPendente = false;

  int chamadasDeExportacao = 0;
  int chamadasDeExclusao = 0;

  @override
  Future<DadosExportados> exportar() {
    chamadasDeExportacao++;
    if (exportacaoPendente) return Completer<DadosExportados>().future;
    if (erroDeExportacao != null) return Future.error(erroDeExportacao!);
    return Future.value(
      const DadosExportados(json: "{}", reservas: 3, avisos: 2),
    );
  }

  @override
  Future<void> excluirConta() {
    chamadasDeExclusao++;
    if (erroDeExclusao != null) return Future.error(erroDeExclusao!);
    return Future.value();
  }
}
