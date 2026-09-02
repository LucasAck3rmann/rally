import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../data/reservas_repository_impl.dart";
import "../domain/reserva.dart";
import "../domain/reservas_repository.dart";

final reservasRepositoryProvider = Provider<ReservasRepository>(
  (ref) => ReservasRepositoryImpl(ref.watch(dioProvider)),
);

/// Histórico do cliente (aba "Reservas").
final minhasReservasProvider = FutureProvider.autoDispose<List<Reserva>>((ref) {
  return ref.watch(reservasRepositoryProvider).minhas();
});

/// Uma reserva específica — usada para acompanhar o pagamento no Pix.
final reservaProvider =
    FutureProvider.autoDispose.family<Reserva, String>((ref, id) {
  return ref.watch(reservasRepositoryProvider).detalhe(id);
});
