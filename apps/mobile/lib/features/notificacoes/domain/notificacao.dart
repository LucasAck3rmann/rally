// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Tipos que a tela agrupa e colore (ver Telas e Fluxos).
enum NotificacaoTipo {
  reserva,
  pagamento,
  replay,
  promocao,
  lembrete,

  /// Tipo que esta versão do aplicativo não conhece.
  ///
  /// O `LEMBRETE` chegava pelo `_`, de modo que qualquer tipo novo da API
  /// aparecia com o sino e a cor de lembrete. Dano menor que o do
  /// [PapelGestao], porque aqui nada volta para a API — mas é a mesma classe
  /// de defeito, e a Matriz dava a classe como fechada pelo #104.
  desconhecido;

  static NotificacaoTipo doTexto(String valor) => switch (valor) {
        "RESERVA" => NotificacaoTipo.reserva,
        "PAGAMENTO" => NotificacaoTipo.pagamento,
        "REPLAY" => NotificacaoTipo.replay,
        "PROMOCAO" => NotificacaoTipo.promocao,
        "LEMBRETE" => NotificacaoTipo.lembrete,
        _ => NotificacaoTipo.desconhecido,
      };

  /// Ícone de linha correspondente em `assets/icons`.
  String get icone => switch (this) {
        NotificacaoTipo.reserva => "calendario",
        NotificacaoTipo.pagamento => "pagamentos",
        NotificacaoTipo.replay => "play-circulo",
        NotificacaoTipo.promocao => "estrela",
        NotificacaoTipo.lembrete => "sino",
        // O sino genérico é o certo aqui: o aviso existe e deve aparecer,
        // só não se sabe de que tipo é. Esconder a notificação seria pior
        // que mostrá-la sem categoria.
        NotificacaoTipo.desconhecido => "sino",
      };
}

/// Aviso in-app (RF-16).
class Notificacao {
  const Notificacao({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.corpo,
    required this.lida,
    required this.criadaEm,
    this.destino,
  });

  final String id;
  final NotificacaoTipo tipo;
  final String titulo;
  final String corpo;
  final bool lida;
  final DateTime criadaEm;

  /// Rota do app que o toque abre, quando houver.
  final String? destino;

  factory Notificacao.doJson(Map<String, dynamic> json) {
    return Notificacao(
      id: json["id"] as String,
      tipo: NotificacaoTipo.doTexto(json["tipo"] as String),
      titulo: json["titulo"] as String,
      corpo: json["corpo"] as String,
      lida: json["lida"] as bool? ?? false,
      criadaEm: DateTime.parse(json["criadaEm"] as String).toLocal(),
      destino: json["destino"] as String?,
    );
  }
}

/// A lista já vem com a contagem de não lidas, para o selo do menu.
class CaixaDeAvisos {
  const CaixaDeAvisos({required this.naoLidas, required this.itens});

  final int naoLidas;
  final List<Notificacao> itens;

  factory CaixaDeAvisos.doJson(Map<String, dynamic> json) {
    return CaixaDeAvisos(
      naoLidas: (json["naoLidas"] as num?)?.toInt() ?? 0,
      itens: (json["itens"] as List? ?? const [])
          .map((n) => Notificacao.doJson(n as Map<String, dynamic>))
          .toList(),
    );
  }
}
