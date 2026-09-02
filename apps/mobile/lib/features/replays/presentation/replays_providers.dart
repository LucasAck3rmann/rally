import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../data/replays_repository_impl.dart";
import "../domain/replay.dart";
import "../domain/replays_repository.dart";

final replaysRepositoryProvider = Provider<ReplaysRepository>(
  (ref) => ReplaysRepositoryImpl(ref.watch(dioProvider)),
);

/// Janela selecionada nos chips da tela.
final periodoReplayProvider =
    StateProvider<PeriodoReplay>((ref) => PeriodoReplay.semana);

final meusReplaysProvider = FutureProvider.autoDispose<List<Replay>>((ref) {
  return ref.watch(replaysRepositoryProvider).meus(
        ref.watch(periodoReplayProvider),
      );
});
