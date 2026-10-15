// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "gestao.dart";

/// Alguem da equipe do estabelecimento (RF-23).
class MembroEquipe {
  const MembroEquipe({
    required this.usuarioId,
    required this.nome,
    required this.email,
    required this.papel,
    required this.desde,
    this.avatarUrl,
  });

  final String usuarioId;
  final String nome;
  final String email;
  final PapelGestao papel;
  final DateTime desde;
  final String? avatarUrl;

  /// Primeira e ultima inicial, como no avatar do Perfil.
  String get iniciais {
    final partes =
        nome.trim().split(RegExp(r"\s+")).where((p) => p.isNotEmpty).toList();
    return switch (partes.length) {
      0 => "?",
      1 => partes.first[0].toUpperCase(),
      _ => (partes.first[0] + partes.last[0]).toUpperCase(),
    };
  }

  factory MembroEquipe.doJson(Map<String, dynamic> json) {
    return MembroEquipe(
      usuarioId: json["usuarioId"] as String,
      nome: json["nome"] as String,
      email: json["email"] as String,
      papel: PapelGestao.doTexto(json["papel"] as String? ?? ""),
      desde: DateTime.parse(json["desde"] as String),
      avatarUrl: json["avatarUrl"] as String?,
    );
  }
}
