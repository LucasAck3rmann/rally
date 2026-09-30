// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/quadras/domain/quadra.dart";
import "package:rally_mobile/features/quadras/domain/quadras_repository.dart";

/// Vitrine e grade de mentira, com registro do que a tela pediu.
class FakeQuadrasRepository implements QuadrasRepository {
  FakeQuadrasRepository({this.slots = const [], this.quadras = const []});

  final List<Slot> slots;
  final List<Quadra> quadras;

  /// Filtros recebidos em `listar`, na ordem — é assim que o teste confere
  /// que o chip e a busca chegaram até a consulta.
  final List<({String? modalidade, String? busca})> consultas = [];

  /// Datas (YYYY-MM-DD) pedidas à grade.
  final List<String> diasConsultados = [];

  /// Quando definido, a próxima chamada falha com este erro.
  Object? erro;

  @override
  Future<List<Quadra>> listar({String? modalidade, String? busca}) async {
    consultas.add((modalidade: modalidade, busca: busca));
    if (erro != null) throw erro!;
    return quadras;
  }

  @override
  Future<Quadra> detalhe(String id) async {
    if (erro != null) throw erro!;
    return quadras.firstWhere(
      (q) => q.id == id,
      orElse: () => quadraFalsa(id: id),
    );
  }

  @override
  Future<Disponibilidade> disponibilidade(String quadraId, String data) async {
    diasConsultados.add(data);
    if (erro != null) throw erro!;
    return Disponibilidade(data: data, slotMinutos: 60, slots: slots);
  }
}

/// Estabelecimento de mentira, com o mínimo que as telas leem.
Estabelecimento estabelecimentoFalso({
  String id = "e1",
  String nome = "Arena Beach Sapiranga",
  String? bairro = "Centro",
  String? cidade = "Sapiranga",
  double? nota = 4.9,
  double descontoPixPct = 5,
}) {
  return Estabelecimento(
    id: id,
    nome: nome,
    bairro: bairro,
    cidade: cidade,
    uf: "RS",
    nota: nota,
    avaliacoes: 128,
    descontoPixPct: descontoPixPct,
  );
}

/// Quadra de mentira.
Quadra quadraFalsa({
  String id = "q1",
  String nome = "Quadra 1",
  double precoHora = 80,
  List<String> modalidades = const ["Futevôlei"],
  Estabelecimento? estabelecimento,
  bool aoVivo = false,
}) {
  return Quadra(
    id: id,
    nome: nome,
    precoHora: precoHora,
    fotos: const [],
    modalidades: modalidades,
    estabelecimento: estabelecimento ?? estabelecimentoFalso(),
    capacidade: 4,
    aoVivo: aoVivo,
  );
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
