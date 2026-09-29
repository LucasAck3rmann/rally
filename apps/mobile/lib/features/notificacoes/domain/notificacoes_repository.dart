// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "notificacao.dart";

/// Contrato dos avisos do cliente autenticado (RF-16).
abstract interface class NotificacoesRepository {
  Future<CaixaDeAvisos> minhas();

  Future<void> marcarLida(String id);

  Future<void> lerTodas();
}
