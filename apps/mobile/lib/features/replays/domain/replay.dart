/// Janela do filtro da tela de Replays.
enum PeriodoReplay {
  semana("semana", "Esta semana"),
  mes("mes", "Este mês"),
  todos("todos", "Todos");

  const PeriodoReplay(this.valor, this.rotulo);

  /// Valor enviado à API.
  final String valor;
  final String rotulo;
}

/// Clipe de um lance — o diferencial do Rally.
class Replay {
  const Replay({
    required this.id,
    required this.titulo,
    required this.criadoEm,
    required this.estabelecimento,
    this.url,
    this.thumbUrl,
    this.duracaoSeg,
  });

  final String id;
  final String titulo;
  final DateTime criadoEm;
  final String estabelecimento;
  final String? url;
  final String? thumbUrl;
  final int? duracaoSeg;

  factory Replay.doJson(Map<String, dynamic> json) {
    return Replay(
      id: json["id"] as String,
      titulo: json["titulo"] as String,
      criadoEm: DateTime.parse(json["criadoEm"] as String).toLocal(),
      estabelecimento: json["estabelecimento"] as String,
      url: json["url"] as String?,
      thumbUrl: json["thumbUrl"] as String?,
      duracaoSeg: (json["duracaoSeg"] as num?)?.toInt(),
    );
  }
}
