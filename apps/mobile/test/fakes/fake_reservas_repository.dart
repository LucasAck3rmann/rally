// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/reservas/domain/reserva.dart";
import "package:rally_mobile/features/reservas/domain/reservas_repository.dart";

/// Reserva de mentira para os testes de tela.
///
/// Os padrões descrevem o caso comum — uma reserva confirmada, no futuro e
/// dentro do prazo de cancelamento; cada teste muda só o que lhe interessa.
Reserva reservaFalsa({
  String id = "r1",
  ReservaStatus status = ReservaStatus.confirmada,
  bool cancelavel = true,
  bool cancelamentoGratuito = true,
  int cancelamentoHoras = 12,
  String estabelecimentoNome = "Arena Beira-Rio",
}) {
  final inicio = DateTime(2026, 6, 17, 19);
  return Reserva(
    id: id,
    codigo: "RALLY-7K2P",
    inicio: inicio,
    fim: inicio.add(const Duration(hours: 1)),
    horaInicio: "19:00",
    horaFim: "20:00",
    status: status,
    preco: 80,
    quadraId: "q1",
    quadraNome: "Quadra 1",
    estabelecimentoNome: estabelecimentoNome,
    modalidades: const ["Beach tennis"],
    fotos: const [],
    cancelavel: cancelavel,
    cancelamentoGratuito: cancelamentoGratuito,
    cancelamentoHoras: cancelamentoHoras,
  );
}

/// Repositório de reservas de mentira: devolve uma lista fixa e registra os
/// cancelamentos pedidos, para o teste conferir o que a tela chamou.
class FakeReservasRepository implements ReservasRepository {
  FakeReservasRepository(this.lista);

  final List<Reserva> lista;

  /// Ids passados para `cancelar`, na ordem.
  final List<String> cancelados = [];

  /// Resposta do próximo `cancelar`.
  bool dentroDoPrazo = true;

  /// Quando definido, o próximo `cancelar` falha com este erro.
  Object? erroAoCancelar;

  /// Quando definido, o próximo `remarcar` falha com este erro.
  Object? erroAoRemarcar;

  /// Quando definido, o próximo `criar` falha com este erro.
  Object? erroAoCriar;

  /// Argumentos da última chamada a `criar`.
  ({String quadraId, DateTime inicio, DateTime fim, String metodo})? criacao;

  @override
  Future<List<Reserva>> minhas() async => lista;

  @override
  Future<Reserva> detalhe(String id) async =>
      lista.firstWhere((r) => r.id == id);

  @override
  Future<Reserva> criar({
    required String quadraId,
    required DateTime inicio,
    required DateTime fim,
    required String metodo,
  }) async {
    criacao = (quadraId: quadraId, inicio: inicio, fim: fim, metodo: metodo);
    if (erroAoCriar != null) throw erroAoCriar!;
    return lista.isEmpty ? reservaFalsa() : lista.first;
  }

  /// Argumentos da última chamada a `remarcar`.
  (String id, DateTime inicio, DateTime fim)? remarcacao;

  @override
  Future<Reserva> remarcar(
    String id, {
    required DateTime inicio,
    required DateTime fim,
  }) async {
    remarcacao = (id, inicio, fim);
    if (erroAoRemarcar != null) throw erroAoRemarcar!;
    return lista.firstWhere((r) => r.id == id);
  }

  @override
  Future<ResultadoCancelamento> cancelar(String id, {String? motivo}) async {
    cancelados.add(id);
    if (erroAoCancelar != null) throw erroAoCancelar!;
    return ResultadoCancelamento(
      reserva: lista.firstWhere((r) => r.id == id),
      dentroDoPrazo: dentroDoPrazo,
    );
  }

  @override
  Future<void> simularPagamento(String reservaId) async {}
}
