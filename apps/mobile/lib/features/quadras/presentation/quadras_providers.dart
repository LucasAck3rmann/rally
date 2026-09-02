import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/network/dio_provider.dart";
import "../../../core/formato.dart";
import "../../promocoes/data/promocoes_repository.dart";
import "../../promocoes/domain/promocao.dart";
import "../data/quadras_repository_impl.dart";
import "../domain/quadra.dart";
import "../domain/quadras_repository.dart";

final quadrasRepositoryProvider = Provider<QuadrasRepository>(
  (ref) => QuadrasRepositoryImpl(ref.watch(dioProvider)),
);

final promocoesRepositoryProvider = Provider<PromocoesRepository>(
  (ref) => PromocoesRepository(ref.watch(dioProvider)),
);

/// Modalidade escolhida nos chips da Home (`null` = todas).
final modalidadeFiltroProvider = StateProvider<String?>((ref) => null);

/// Texto do campo de busca (já com debounce aplicado na tela).
final buscaProvider = StateProvider<String>((ref) => "");

/// Vitrine da Home — recarrega sozinha quando o filtro ou a busca mudam.
final quadrasProvider = FutureProvider.autoDispose<List<Quadra>>((ref) {
  return ref.watch(quadrasRepositoryProvider).listar(
        modalidade: ref.watch(modalidadeFiltroProvider),
        busca: ref.watch(buscaProvider),
      );
});

final quadraDetalheProvider =
    FutureProvider.autoDispose.family<Quadra, String>((ref, id) {
  return ref.watch(quadrasRepositoryProvider).detalhe(id);
});

final promocaoDestaqueProvider =
    FutureProvider.autoDispose<PromocaoDestaque?>((ref) {
  return ref.watch(promocoesRepositoryProvider).destaque();
});

/// Argumentos da consulta de disponibilidade de um dia.
typedef ConsultaAgenda = ({String quadraId, DateTime dia});

final disponibilidadeProvider = FutureProvider.autoDispose
    .family<Disponibilidade, ConsultaAgenda>((ref, consulta) {
  return ref
      .watch(quadrasRepositoryProvider)
      .disponibilidade(consulta.quadraId, Formato.dataIso(consulta.dia));
});
