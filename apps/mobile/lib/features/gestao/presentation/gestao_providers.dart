// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../data/gestao_repository_impl.dart";
import "../domain/gestao.dart";
import "../domain/gestao_repository.dart";

final gestaoRepositoryProvider = Provider<GestaoRepository>(
  (ref) => GestaoRepositoryImpl(ref.watch(dioProvider)),
);

/// Estabelecimentos que o usuário administra.
///
/// Sem `autoDispose`: o Perfil consulta para decidir se mostra a entrada de
/// gestão, e a própria tela de gestão relê logo em seguida — refazer a
/// chamada entre as duas seria desperdício.
final meusEstabelecimentosProvider =
    FutureProvider<List<EstabelecimentoGerido>>((ref) {
  return ref.watch(gestaoRepositoryProvider).meusEstabelecimentos();
});

/// Quadras de um estabelecimento, na visão do dono.
final quadrasGestaoProvider = FutureProvider.autoDispose
    .family<List<QuadraGestao>, String>((ref, estabelecimentoId) {
  return ref.watch(gestaoRepositoryProvider).quadras(estabelecimentoId);
});
