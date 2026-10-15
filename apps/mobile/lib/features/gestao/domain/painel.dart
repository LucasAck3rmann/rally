// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Receita do período, separada pelo que já entrou (RF-22).
class ReceitaPainel {
  const ReceitaPainel({
    required this.paga,
    required this.aReceber,
    required this.total,
    this.ticketMedio,
  });

  final double paga;

  /// Reservado e ainda não pago. Pix pendente expira, então não é caixa.
  final double aReceber;
  final double total;

  /// `null` quando não houve venda — zero diria "o ticket é zero".
  final double? ticketMedio;

  factory ReceitaPainel.doJson(Map<String, dynamic> json) => ReceitaPainel(
        paga: (json["paga"] as num?)?.toDouble() ?? 0,
        aReceber: (json["aReceber"] as num?)?.toDouble() ?? 0,
        total: (json["total"] as num?)?.toDouble() ?? 0,
        ticketMedio: (json["ticketMedio"] as num?)?.toDouble(),
      );
}

/// Quanto da porta aberta virou jogo.
class OcupacaoPainel {
  const OcupacaoPainel({
    required this.horasVendidas,
    required this.horasDisponiveis,
    this.percentual,
  });

  final double horasVendidas;
  final double horasDisponiveis;

  /// `null` sem horário de funcionamento cadastrado: não há denominador, e
  /// "0%" diria que a arena está vazia.
  final double? percentual;

  factory OcupacaoPainel.doJson(Map<String, dynamic> json) => OcupacaoPainel(
        horasVendidas: (json["horasVendidas"] as num?)?.toDouble() ?? 0,
        horasDisponiveis: (json["horasDisponiveis"] as num?)?.toDouble() ?? 0,
        percentual: (json["percentual"] as num?)?.toDouble(),
      );
}

/// Contagem de reservas do período.
class ContagemPainel {
  const ContagemPainel({
    required this.vendidas,
    required this.canceladas,
    required this.bloqueios,
    this.taxaCancelamento,
  });

  final int vendidas;
  final int canceladas;
  final int bloqueios;
  final double? taxaCancelamento;

  factory ContagemPainel.doJson(Map<String, dynamic> json) => ContagemPainel(
        vendidas: (json["vendidas"] as num?)?.toInt() ?? 0,
        canceladas: (json["canceladas"] as num?)?.toInt() ?? 0,
        bloqueios: (json["bloqueios"] as num?)?.toInt() ?? 0,
        taxaCancelamento: (json["taxaCancelamento"] as num?)?.toDouble(),
      );
}

/// Desempenho de uma quadra no período.
class QuadraNoPainel {
  const QuadraNoPainel({
    required this.quadraId,
    required this.nome,
    required this.reservas,
    required this.horasVendidas,
    required this.receita,
    this.ocupacao,
  });

  final String quadraId;
  final String nome;
  final int reservas;
  final double horasVendidas;
  final double receita;
  final double? ocupacao;

  factory QuadraNoPainel.doJson(Map<String, dynamic> json) => QuadraNoPainel(
        quadraId: json["quadraId"] as String,
        nome: json["nome"] as String,
        reservas: (json["reservas"] as num?)?.toInt() ?? 0,
        horasVendidas: (json["horasVendidas"] as num?)?.toDouble() ?? 0,
        receita: (json["receita"] as num?)?.toDouble() ?? 0,
        ocupacao: (json["ocupacao"] as num?)?.toDouble(),
      );
}

/// Um jogo que ainda vai acontecer.
class ProximoJogo {
  const ProximoJogo({
    required this.id,
    required this.quadraNome,
    required this.inicio,
    required this.horaInicio,
    required this.horaFim,
    required this.preco,
    required this.pago,
    this.clienteNome,
  });

  final String id;
  final String quadraNome;
  final DateTime inicio;
  final String horaInicio;
  final String horaFim;
  final double preco;
  final bool pago;
  final String? clienteNome;

  factory ProximoJogo.doJson(Map<String, dynamic> json) => ProximoJogo(
        id: json["id"] as String,
        quadraNome: json["quadraNome"] as String,
        inicio: DateTime.parse(json["inicio"] as String),
        horaInicio: json["horaInicio"] as String,
        horaFim: json["horaFim"] as String,
        preco: (json["preco"] as num?)?.toDouble() ?? 0,
        pago: json["pago"] as bool? ?? false,
        clienteNome: json["clienteNome"] as String?,
      );
}

/// O painel inteiro (RF-22).
class Painel {
  const Painel({
    required this.dias,
    required this.de,
    required this.ate,
    required this.receita,
    required this.ocupacao,
    required this.contagem,
    required this.quadras,
    required this.proximosJogos,
  });

  final int dias;
  final String de;
  final String ate;
  final ReceitaPainel receita;
  final OcupacaoPainel ocupacao;
  final ContagemPainel contagem;
  final List<QuadraNoPainel> quadras;
  final List<ProximoJogo> proximosJogos;

  /// Se o período inteiro não teve movimento nenhum.
  bool get vazio =>
      contagem.vendidas == 0 &&
      contagem.canceladas == 0 &&
      proximosJogos.isEmpty;

  factory Painel.doJson(Map<String, dynamic> json) {
    final periodo = (json["periodo"] as Map<String, dynamic>?) ?? const {};
    return Painel(
      dias: (periodo["dias"] as num?)?.toInt() ?? 7,
      de: periodo["de"] as String? ?? "",
      ate: periodo["ate"] as String? ?? "",
      receita: ReceitaPainel.doJson(
        (json["receita"] as Map<String, dynamic>?) ?? const {},
      ),
      ocupacao: OcupacaoPainel.doJson(
        (json["ocupacao"] as Map<String, dynamic>?) ?? const {},
      ),
      contagem: ContagemPainel.doJson(
        (json["reservas"] as Map<String, dynamic>?) ?? const {},
      ),
      quadras: ((json["porQuadra"] as List?) ?? const [])
          .map((q) => QuadraNoPainel.doJson(q as Map<String, dynamic>))
          .toList(),
      proximosJogos: ((json["proximosJogos"] as List?) ?? const [])
          .map((j) => ProximoJogo.doJson(j as Map<String, dynamic>))
          .toList(),
    );
  }
}
