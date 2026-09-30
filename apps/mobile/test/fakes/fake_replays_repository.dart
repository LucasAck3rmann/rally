// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/replays/domain/replay.dart";
import "package:rally_mobile/features/replays/domain/replays_repository.dart";

/// Clipe de mentira.
Replay replayFalso({
  String id = "rp1",
  String titulo = "Ponto do jogo",
  String estabelecimento = "Arena Beach Sapiranga",
  int diasAtras = 0,
  int duracaoSeg = 42,
}) {
  return Replay(
    id: id,
    titulo: titulo,
    criadoEm: DateTime.now().subtract(Duration(days: diasAtras, minutes: 5)),
    estabelecimento: estabelecimento,
    duracaoSeg: duracaoSeg,
  );
}

/// Devolve uma lista fixa e registra o período pedido — é assim que o teste
/// confere que o chip escolhido chegou até a consulta.
class FakeReplaysRepository implements ReplaysRepository {
  FakeReplaysRepository(this.lista);

  final List<Replay> lista;

  /// Períodos recebidos, na ordem.
  final List<PeriodoReplay> periodos = [];

  /// Quando definido, a próxima consulta falha com este erro.
  Object? erro;

  @override
  Future<List<Replay>> meus(PeriodoReplay periodo) async {
    periodos.add(periodo);
    if (erro != null) throw erro!;
    return lista;
  }
}
