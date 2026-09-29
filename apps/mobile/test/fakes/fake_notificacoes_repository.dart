// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/features/notificacoes/domain/notificacao.dart";
import "package:rally_mobile/features/notificacoes/domain/notificacoes_repository.dart";

/// Aviso de mentira. `idadeEmDias` posiciona o item nos grupos da tela.
Notificacao avisoFalso({
  String id = "n1",
  NotificacaoTipo tipo = NotificacaoTipo.pagamento,
  String titulo = "Pagamento confirmado",
  String corpo = "Arena Beira-Rio · Quadra 1",
  bool lida = false,
  int idadeEmDias = 0,
  String? destino,
}) {
  return Notificacao(
    id: id,
    tipo: tipo,
    titulo: titulo,
    corpo: corpo,
    lida: lida,
    criadaEm: DateTime.now().subtract(Duration(days: idadeEmDias, minutes: 5)),
    destino: destino,
  );
}

class FakeNotificacoesRepository implements NotificacoesRepository {
  FakeNotificacoesRepository(this.itens);

  List<Notificacao> itens;

  /// Ids passados para `marcarLida`, na ordem.
  final List<String> marcadas = [];
  int chamadasLerTodas = 0;

  /// Quando definido, a próxima leitura da caixa falha com este erro.
  Object? erroAoCarregar;

  @override
  Future<CaixaDeAvisos> minhas() async {
    if (erroAoCarregar != null) throw erroAoCarregar!;
    return CaixaDeAvisos(
      naoLidas: itens.where((n) => !n.lida).length,
      itens: itens,
    );
  }

  @override
  Future<void> marcarLida(String id) async {
    marcadas.add(id);
  }

  @override
  Future<void> lerTodas() async {
    chamadasLerTodas++;
    itens = [
      for (final n in itens)
        Notificacao(
          id: n.id,
          tipo: n.tipo,
          titulo: n.titulo,
          corpo: n.corpo,
          lida: true,
          criadaEm: n.criadaEm,
          destino: n.destino,
        ),
    ];
  }
}
