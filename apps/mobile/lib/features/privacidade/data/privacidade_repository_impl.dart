// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "dart:convert";

import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/privacidade_repository.dart";

/// Fala com `/privacidade/*` da API (RNF-07).
class PrivacidadeRepositoryImpl implements PrivacidadeRepository {
  const PrivacidadeRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<DadosExportados> exportar() async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>("/privacidade/meus-dados");
      final corpo = res.data ?? const <String, dynamic>{};

      return DadosExportados(
        // Identado de proposito: o arquivo e para uma pessoa abrir, e JSON
        // numa linha so e ilegivel em qualquer visualizador.
        json: const JsonEncoder.withIndent("  ").convert(corpo),
        reservas: (corpo["reservas"] as List?)?.length ?? 0,
        avisos: (corpo["avisos"] as List?)?.length ?? 0,
      );
    } on DioException catch (e) {
      throw PrivacidadeException(
        mensagemDeDio(e, padrao: "Nao foi possivel exportar agora."),
      );
    }
  }

  @override
  Future<void> excluirConta() async {
    try {
      await _dio.delete<Map<String, dynamic>>("/privacidade/minha-conta");
    } on DioException catch (e) {
      // A recusa de "ultima administradora" chega aqui com a mensagem da
      // API, que diz o que fazer; trocar por texto generico apagaria a
      // unica parte util.
      throw PrivacidadeException(
        mensagemDeDio(e, padrao: "Nao foi possivel excluir a conta agora."),
      );
    }
  }
}
