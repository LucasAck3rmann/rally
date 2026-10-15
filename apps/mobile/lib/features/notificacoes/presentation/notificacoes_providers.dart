// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../data/notificacoes_repository_impl.dart";
import "../domain/notificacao.dart";
import "../domain/notificacoes_repository.dart";

final notificacoesRepositoryProvider = Provider<NotificacoesRepository>(
  (ref) => NotificacoesRepositoryImpl(ref.watch(dioProvider)),
);

/// Caixa de avisos do cliente — a tela e o selo do menu leem daqui.
final caixaDeAvisosProvider = FutureProvider.autoDispose<CaixaDeAvisos>((ref) {
  return ref.watch(notificacoesRepositoryProvider).minhas();
});
