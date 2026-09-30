// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Papel do usuário dentro de um estabelecimento (RF-02).
///
/// Espelha o enum `Role` da API. `cliente` existe lá, mas não chega aqui: o
/// seletor de gestão só lista vínculos de quem administra alguma coisa.
enum PapelGestao {
  atendente,
  financeiro,
  admin,
  mantenedor;

  static PapelGestao doTexto(String valor) => switch (valor) {
        "ADMIN" => PapelGestao.admin,
        "FINANCEIRO" => PapelGestao.financeiro,
        "MANTENEDOR" => PapelGestao.mantenedor,
        _ => PapelGestao.atendente,
      };

  String get rotulo => switch (this) {
        PapelGestao.atendente => "Atendente",
        PapelGestao.financeiro => "Financeiro",
        PapelGestao.admin => "Administrador",
        PapelGestao.mantenedor => "Mantenedor",
      };

  /// Só o administrador cria, edita ou pausa quadra — é o que a API exige
  /// em `@Papeis(Role.ADMIN)`. A tela esconde o que o servidor recusaria.
  bool get podeEditarQuadras =>
      this == PapelGestao.admin || this == PapelGestao.mantenedor;
}

/// Estabelecimento que o usuário administra.
class EstabelecimentoGerido {
  const EstabelecimentoGerido({
    required this.id,
    required this.nome,
    required this.plano,
    required this.ativo,
    required this.quadras,
    required this.meuPapel,
    this.cidade,
    this.uf,
  });

  final String id;
  final String nome;

  /// "FREE", "PRO" ou "CLUBE".
  final String plano;
  final bool ativo;

  /// Quantas quadras o estabelecimento tem cadastradas.
  final int quadras;
  final PapelGestao meuPapel;
  final String? cidade;
  final String? uf;

  String get localizacao =>
      [cidade, uf].where((p) => p != null && p.isNotEmpty).join(" · ");

  factory EstabelecimentoGerido.doJson(Map<String, dynamic> json) {
    return EstabelecimentoGerido(
      id: json["id"] as String,
      nome: json["nome"] as String,
      plano: json["plano"] as String? ?? "FREE",
      ativo: json["ativo"] as bool? ?? true,
      quadras: (json["quadras"] as num?)?.toInt() ?? 0,
      meuPapel: PapelGestao.doTexto(json["meuPapel"] as String? ?? ""),
      cidade: json["cidade"] as String?,
      uf: json["uf"] as String?,
    );
  }
}

/// Preço de uma janela específica — sobrescreve o preço-base (RN-04).
class FaixaPreco {
  const FaixaPreco({
    required this.id,
    required this.diaSemana,
    required this.horaInicio,
    required this.horaFim,
    required this.precoHora,
  });

  final String id;

  /// 0 = domingo, como no `DateTime.weekday` da API.
  final int diaSemana;
  final String horaInicio;
  final String horaFim;
  final double precoHora;

  factory FaixaPreco.doJson(Map<String, dynamic> json) {
    return FaixaPreco(
      id: json["id"] as String,
      diaSemana: (json["diaSemana"] as num).toInt(),
      horaInicio: json["horaInicio"] as String,
      horaFim: json["horaFim"] as String,
      precoHora: (json["precoHora"] as num).toDouble(),
    );
  }
}

/// Quadra na visão do dono — traz o que a vitrine esconde (pausada, faixas).
class QuadraGestao {
  const QuadraGestao({
    required this.id,
    required this.nome,
    required this.precoHora,
    required this.ativo,
    required this.modalidades,
    required this.fotos,
    required this.comodidades,
    required this.faixasPreco,
    this.descricao,
    this.capacidade,
  });

  final String id;
  final String nome;
  final double precoHora;

  /// `false` = pausada: fora da vitrine, mas com o histórico preservado.
  final bool ativo;
  final List<String> modalidades;
  final List<String> fotos;
  final List<String> comodidades;
  final List<FaixaPreco> faixasPreco;
  final String? descricao;
  final int? capacidade;

  String? get foto => fotos.isEmpty ? null : fotos.first;

  factory QuadraGestao.doJson(Map<String, dynamic> json) {
    return QuadraGestao(
      id: json["id"] as String,
      nome: json["nome"] as String,
      precoHora: (json["precoHora"] as num).toDouble(),
      ativo: json["ativo"] as bool? ?? true,
      modalidades: (json["modalidades"] as List?)?.cast<String>() ?? const [],
      fotos: (json["fotos"] as List?)?.cast<String>() ?? const [],
      comodidades: (json["comodidades"] as List?)?.cast<String>() ?? const [],
      faixasPreco: (json["faixasPreco"] as List?)
              ?.map((f) => FaixaPreco.doJson(f as Map<String, dynamic>))
              .toList() ??
          const [],
      descricao: json["descricao"] as String?,
      capacidade: (json["capacidade"] as num?)?.toInt(),
    );
  }
}
