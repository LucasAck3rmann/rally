// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/gestao.dart";
import "../domain/gestao_repository.dart";

/// Conversa com `/gestao` na API. Todas as rotas passam pelo `PapelGuard`,
/// que decide o acesso pelo vínculo do usuário — não pelo token.
class GestaoRepositoryImpl implements GestaoRepository {
  const GestaoRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<EstabelecimentoGerido>> meusEstabelecimentos() {
    return chamarApi(
      () async {
        final res = await _dio.get<List<dynamic>>("/gestao/estabelecimentos");
        return (res.data ?? const [])
            .map((e) => EstabelecimentoGerido.doJson(e as Map<String, dynamic>))
            .toList();
      },
      erroPadrao: "Não foi possível carregar seus estabelecimentos.",
    );
  }

  @override
  Future<List<QuadraGestao>> quadras(String estabelecimentoId) {
    return chamarApi(
      () async {
        final res = await _dio.get<List<dynamic>>(
          "/gestao/estabelecimentos/$estabelecimentoId/quadras",
        );
        return (res.data ?? const [])
            .map((q) => QuadraGestao.doJson(q as Map<String, dynamic>))
            .toList();
      },
      erroPadrao: "Não foi possível carregar as quadras.",
    );
  }

  @override
  Future<QuadraGestao> detalheQuadra(
    String estabelecimentoId,
    String quadraId,
  ) {
    return chamarApi(
      () async {
        final res = await _dio.get<Map<String, dynamic>>(
          "/gestao/estabelecimentos/$estabelecimentoId/quadras/$quadraId",
        );
        return QuadraGestao.doJson(res.data!);
      },
      erroPadrao: "Não foi possível carregar a quadra.",
    );
  }

  @override
  Future<QuadraGestao> criarQuadra(
    String estabelecimentoId,
    DadosQuadra dados,
  ) {
    return chamarApi(
      () async {
        final res = await _dio.post<Map<String, dynamic>>(
          "/gestao/estabelecimentos/$estabelecimentoId/quadras",
          data: dados.paraJson(),
        );
        return QuadraGestao.doJson(res.data!);
      },
      erroPadrao: "Não foi possível cadastrar a quadra.",
    );
  }

  @override
  Future<QuadraGestao> atualizarQuadra(
    String estabelecimentoId,
    String quadraId,
    DadosQuadra dados,
  ) {
    return chamarApi(
      () async {
        final res = await _dio.patch<Map<String, dynamic>>(
          "/gestao/estabelecimentos/$estabelecimentoId/quadras/$quadraId",
          data: dados.paraJson(),
        );
        return QuadraGestao.doJson(res.data!);
      },
      erroPadrao: "Não foi possível salvar a quadra.",
    );
  }

  @override
  Future<QuadraGestao> definirAtivo(
    String estabelecimentoId,
    String quadraId, {
    required bool ativo,
  }) {
    return chamarApi(
      () async {
        final res = await _dio.patch<Map<String, dynamic>>(
          "/gestao/estabelecimentos/$estabelecimentoId/quadras/$quadraId",
          data: {"ativo": ativo},
        );
        return QuadraGestao.doJson(res.data!);
      },
      erroPadrao: ativo
          ? "Não foi possível reativar a quadra."
          : "Não foi possível pausar a quadra.",
    );
  }
}
