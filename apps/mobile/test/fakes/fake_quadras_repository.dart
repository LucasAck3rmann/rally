// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/quadras/domain/quadra.dart";
import "package:rally_mobile/features/quadras/domain/quadras_repository.dart";

/// Grade de mentira: devolve sempre os mesmos horários, seja qual for o dia.
class FakeQuadrasRepository implements QuadrasRepository {
  FakeQuadrasRepository({this.slots = const []});

  final List<Slot> slots;

  /// Datas (YYYY-MM-DD) consultadas, na ordem.
  final List<String> diasConsultados = [];

  @override
  Future<Disponibilidade> disponibilidade(String quadraId, String data) async {
    diasConsultados.add(data);
    return Disponibilidade(data: data, slotMinutos: 60, slots: slots);
  }

  @override
  Future<List<Quadra>> listar({String? modalidade, String? busca}) {
    throw UnimplementedError();
  }

  @override
  Future<Quadra> detalhe(String id) => throw UnimplementedError();
}

/// Slot de uma hora começando em [hora] do dia seguinte.
Slot slotFalso(int hora, {bool disponivel = true, double preco = 80}) {
  final amanha = DateTime.now().add(const Duration(days: 1));
  final inicio = DateTime(amanha.year, amanha.month, amanha.day, hora);
  return Slot(
    inicio: inicio,
    fim: inicio.add(const Duration(hours: 1)),
    hora: "${hora.toString().padLeft(2, "0")}:00",
    disponivel: disponivel,
    preco: preco,
  );
}
