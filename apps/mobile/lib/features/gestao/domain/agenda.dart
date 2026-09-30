// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Um compromisso na agenda do dono: reserva de cliente ou bloqueio (RF-21).
class ItemAgenda {
  const ItemAgenda({
    required this.id,
    required this.quadraId,
    required this.quadraNome,
    required this.inicio,
    required this.fim,
    required this.horaInicio,
    required this.horaFim,
    required this.status,
    required this.ehBloqueio,
    this.preco,
    this.motivo,
    this.clienteNome,
    this.clienteTelefone,
  });

  final String id;
  final String quadraId;
  final String quadraNome;
  final DateTime inicio;
  final DateTime fim;

  /// "19:00" no fuso do estabelecimento — quem calcula é a API, porque o
  /// celular do dono pode estar em outro fuso que o da arena.
  final String horaInicio;
  final String horaFim;

  /// `CONFIRMADA`, `PENDENTE_PAGAMENTO`, `BLOQUEIO`…
  final String status;
  final bool ehBloqueio;

  /// `null` num bloqueio: não há cobrança, e zero seria mentira diferente.
  final double? preco;

  /// Só em bloqueio: "Manutenção da rede".
  final String? motivo;
  final String? clienteNome;
  final String? clienteTelefone;

  /// Quantas horas inteiras o item ocupa na grade, no mínimo uma.
  int get duracaoEmHoras {
    final minutos = fim.difference(inicio).inMinutes;
    final horas = (minutos / 60).ceil();
    return horas < 1 ? 1 : horas;
  }

  /// Hora cheia em que o item começa, que é como a grade indexa as linhas.
  int get horaDeInicio => int.tryParse(horaInicio.split(":").first) ?? 0;

  factory ItemAgenda.doJson(Map<String, dynamic> json) {
    return ItemAgenda(
      id: json["id"] as String,
      quadraId: json["quadraId"] as String,
      quadraNome: json["quadraNome"] as String,
      inicio: DateTime.parse(json["inicio"] as String),
      fim: DateTime.parse(json["fim"] as String),
      horaInicio: json["horaInicio"] as String,
      horaFim: json["horaFim"] as String,
      status: json["status"] as String,
      ehBloqueio: json["ehBloqueio"] as bool? ?? false,
      preco: (json["preco"] as num?)?.toDouble(),
      motivo: json["motivo"] as String?,
      clienteNome:
          (json["cliente"] as Map<String, dynamic>?)?["nome"] as String?,
      clienteTelefone:
          (json["cliente"] as Map<String, dynamic>?)?["telefone"] as String?,
    );
  }
}

/// Uma quadra na régua horizontal da agenda.
class QuadraDaAgenda {
  const QuadraDaAgenda({required this.id, required this.nome});

  final String id;
  final String nome;

  factory QuadraDaAgenda.doJson(Map<String, dynamic> json) =>
      QuadraDaAgenda(id: json["id"] as String, nome: json["nome"] as String);
}

/// O dia inteiro do estabelecimento.
class AgendaDoDia {
  const AgendaDoDia({
    required this.data,
    required this.timezone,
    required this.quadras,
    required this.itens,
  });

  /// "2026-10-05".
  final String data;
  final String timezone;
  final List<QuadraDaAgenda> quadras;
  final List<ItemAgenda> itens;

  /// Itens de uma quadra, na ordem do dia.
  List<ItemAgenda> daQuadra(String quadraId) =>
      itens.where((i) => i.quadraId == quadraId).toList();

  /// O que ocupa exatamente esta hora nesta quadra, se houver algo.
  ///
  /// Compara por intervalo e não por hora de início: uma reserva de duas
  /// horas ocupa a segunda hora sem começar nela, e uma grade que só olha o
  /// início ofereceria aquela célula como livre.
  ItemAgenda? em(String quadraId, int hora) {
    for (final item in itens) {
      if (item.quadraId != quadraId) continue;
      final comeca = item.horaDeInicio;
      if (hora >= comeca && hora < comeca + item.duracaoEmHoras) return item;
    }
    return null;
  }

  /// Faixa de horas que a grade desenha.
  ///
  /// Parte de 8h–22h e só cresce para caber o que existe no dia: começar em
  /// 00h deixaria o dono rolando por oito linhas vazias antes do primeiro
  /// jogo, e cortar em 22h esconderia o jogo das 23h.
  ({int primeira, int ultima}) get faixaDeHoras {
    var primeira = 8;
    var ultima = 22;
    for (final item in itens) {
      final comeca = item.horaDeInicio;
      final termina = comeca + item.duracaoEmHoras - 1;
      if (comeca < primeira) primeira = comeca;
      if (termina > ultima) ultima = termina;
    }
    return (primeira: primeira, ultima: ultima);
  }

  factory AgendaDoDia.doJson(Map<String, dynamic> json) {
    return AgendaDoDia(
      data: json["data"] as String,
      timezone: json["timezone"] as String? ?? "America/Sao_Paulo",
      quadras: ((json["quadras"] as List?) ?? const [])
          .map((q) => QuadraDaAgenda.doJson(q as Map<String, dynamic>))
          .toList(),
      itens: ((json["itens"] as List?) ?? const [])
          .map((i) => ItemAgenda.doJson(i as Map<String, dynamic>))
          .toList(),
    );
  }
}
