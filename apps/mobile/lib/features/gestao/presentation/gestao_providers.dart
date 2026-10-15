// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../data/gestao_repository_impl.dart";
import "../domain/agenda.dart";
import "../domain/equipe.dart";
import "../domain/gestao.dart";
import "../domain/painel.dart";
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

/// Uma quadra para o formulário de edição.
final quadraGestaoProvider = FutureProvider.autoDispose
    .family<QuadraGestao, ({String estabelecimentoId, String quadraId})>((
  ref,
  chave,
) {
  return ref
      .watch(gestaoRepositoryProvider)
      .detalheQuadra(chave.estabelecimentoId, chave.quadraId);
});

/// A agenda de um dia. A chave carrega a data porque trocar de dia é o gesto
/// principal da tela — sem ela, voltar para ontem refaria a chamada.
final agendaProvider = FutureProvider.autoDispose
    .family<AgendaDoDia, ({String estabelecimentoId, String data})>((
  ref,
  chave,
) {
  return ref
      .watch(gestaoRepositoryProvider)
      .agenda(chave.estabelecimentoId, chave.data);
});

/// O painel de um período. Trocar de janela (7, 30 dias) refaz a consulta,
/// porque o recorte é a pergunta que o dono está fazendo.
final painelProvider = FutureProvider.autoDispose
    .family<Painel, ({String estabelecimentoId, int dias})>((ref, chave) {
  return ref
      .watch(gestaoRepositoryProvider)
      .painel(chave.estabelecimentoId, dias: chave.dias);
});

/// A equipe do estabelecimento.
final equipeProvider = FutureProvider.autoDispose
    .family<List<MembroEquipe>, String>((ref, estabelecimentoId) {
  return ref.watch(gestaoRepositoryProvider).equipe(estabelecimentoId);
});
