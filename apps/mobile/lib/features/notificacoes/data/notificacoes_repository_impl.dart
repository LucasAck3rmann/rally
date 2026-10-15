// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/notificacao.dart";
import "../domain/notificacoes_repository.dart";

/// Conversa com `/notificacoes` na API.
class NotificacoesRepositoryImpl implements NotificacoesRepository {
  const NotificacoesRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<CaixaDeAvisos> minhas() {
    return chamarApi(
      () async {
        final res = await _dio.get<Map<String, dynamic>>("/notificacoes");
        return CaixaDeAvisos.doJson(res.data!);
      },
      erroPadrao: "Não foi possível carregar as notificações.",
    );
  }

  @override
  Future<void> marcarLida(String id) {
    return chamarApi(
      () => _dio.post<Map<String, dynamic>>("/notificacoes/$id/lida"),
      erroPadrao: "Não foi possível marcar como lida.",
    );
  }

  @override
  Future<void> lerTodas() {
    return chamarApi(
      () => _dio.post<Map<String, dynamic>>("/notificacoes/ler-todas"),
      erroPadrao: "Não foi possível marcar todas como lidas.",
    );
  }
}
