// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Direitos do titular dos dados (RNF-07, LGPD).
abstract interface class PrivacidadeRepository {
  /// Tudo o que o sistema guarda sobre quem esta autenticado, em JSON.
  ///
  /// Devolve o texto pronto, e nao um objeto: o direito aqui e de
  /// portabilidade, e quem recebe o arquivo precisa dele como veio da API —
  /// remontar no aplicativo seria reescrever o dado antes de entrega-lo.
  Future<DadosExportados> exportar();

  /// Elimina a conta por anonimizacao. A sessao nao sobrevive a isto.
  Future<void> excluirConta();
}

/// O arquivo exportado e o que da para dizer sobre ele sem abri-lo.
class DadosExportados {
  const DadosExportados({
    required this.json,
    required this.reservas,
    required this.avisos,
  });

  /// O JSON como a API devolveu, formatado para leitura.
  final String json;

  /// Contagens para a tela dizer o que foi exportado sem exibir tudo.
  final int reservas;
  final int avisos;

  int get bytes => json.length;
}

/// Falha com mensagem pronta para a tela.
class PrivacidadeException implements Exception {
  const PrivacidadeException(this.message);
  final String message;

  @override
  String toString() => message;
}
