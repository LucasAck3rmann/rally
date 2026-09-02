/// Estabelecimento dono da quadra (nome e localização mostrados nos cards).
class Estabelecimento {
  const Estabelecimento({
    required this.id,
    required this.nome,
    required this.bairro,
    required this.cidade,
    required this.uf,
    required this.nota,
    required this.avaliacoes,
    required this.descontoPixPct,
  });

  final String id;
  final String nome;
  final String? bairro;
  final String? cidade;
  final String? uf;
  final double? nota;
  final int avaliacoes;

  /// Desconto aplicado quando o pagamento é no Pix (ex.: 5).
  final double descontoPixPct;

  /// "Centro · Sapiranga" — a linha de apoio abaixo do nome.
  String get localizacao =>
      [bairro, cidade].where((p) => p != null && p.isNotEmpty).join(" · ");

  factory Estabelecimento.doJson(Map<String, dynamic> json) {
    return Estabelecimento(
      id: json["id"] as String,
      nome: json["nome"] as String,
      bairro: json["bairro"] as String?,
      cidade: json["cidade"] as String?,
      uf: json["uf"] as String?,
      nota: (json["nota"] as num?)?.toDouble(),
      avaliacoes: (json["avaliacoes"] as num?)?.toInt() ?? 0,
      descontoPixPct: (json["descontoPixPct"] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Quadra de areia disponível para reserva.
class Quadra {
  const Quadra({
    required this.id,
    required this.nome,
    required this.precoHora,
    required this.fotos,
    required this.modalidades,
    required this.estabelecimento,
    this.capacidade,
    this.descricao,
    this.comodidades = const [],
    this.aoVivo = false,
  });

  final String id;
  final String nome;
  final double precoHora;
  final List<String> fotos;
  final List<String> modalidades;
  final Estabelecimento estabelecimento;
  final int? capacidade;

  /// Só vem no detalhe.
  final String? descricao;
  final List<String> comodidades;

  /// Tem jogo acontecendo agora — o selo "ao vivo" do card.
  final bool aoVivo;

  String? get fotoPrincipal => fotos.isEmpty ? null : fotos.first;

  factory Quadra.doJson(Map<String, dynamic> json) {
    return Quadra(
      id: json["id"] as String,
      nome: json["nome"] as String,
      precoHora: (json["precoHora"] as num).toDouble(),
      fotos: (json["fotos"] as List?)?.cast<String>() ?? const [],
      modalidades: (json["modalidades"] as List?)?.cast<String>() ?? const [],
      estabelecimento: Estabelecimento.doJson(
        json["estabelecimento"] as Map<String, dynamic>,
      ),
      capacidade: (json["capacidade"] as num?)?.toInt(),
      descricao: json["descricao"] as String?,
      comodidades: (json["comodidades"] as List?)?.cast<String>() ?? const [],
      aoVivo: json["aoVivo"] as bool? ?? false,
    );
  }
}

/// Uma faixa de horário na grade do dia.
class Slot {
  const Slot({
    required this.inicio,
    required this.fim,
    required this.hora,
    required this.disponivel,
    required this.preco,
  });

  final DateTime inicio;
  final DateTime fim;

  /// Rótulo já no fuso do estabelecimento, ex.: "19:00".
  final String hora;
  final bool disponivel;
  final double preco;

  factory Slot.doJson(Map<String, dynamic> json) {
    return Slot(
      inicio: DateTime.parse(json["inicio"] as String).toLocal(),
      fim: DateTime.parse(json["fim"] as String).toLocal(),
      hora: json["hora"] as String,
      disponivel: json["disponivel"] as bool,
      preco: (json["preco"] as num).toDouble(),
    );
  }
}

/// Grade de horários de um dia.
class Disponibilidade {
  const Disponibilidade({
    required this.data,
    required this.slotMinutos,
    required this.slots,
  });

  final String data;
  final int slotMinutos;
  final List<Slot> slots;

  factory Disponibilidade.doJson(Map<String, dynamic> json) {
    return Disponibilidade(
      data: json["data"] as String,
      slotMinutos: (json["slotMinutos"] as num).toInt(),
      slots: (json["slots"] as List)
          .map((s) => Slot.doJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}
