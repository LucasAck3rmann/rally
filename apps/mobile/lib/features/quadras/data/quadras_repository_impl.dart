import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/quadra.dart";
import "../domain/quadras_repository.dart";

/// Conversa com `/quadras` na API do Rally.
class QuadrasRepositoryImpl implements QuadrasRepository {
  const QuadrasRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<Quadra>> listar({String? modalidade, String? busca}) {
    return chamarApi(
      () async {
        final res = await _dio.get<List<dynamic>>(
          "/quadras",
          queryParameters: {
            if (modalidade != null) "modalidade": modalidade,
            if (busca != null && busca.isNotEmpty) "busca": busca,
          },
        );
        return (res.data ?? const [])
            .map((q) => Quadra.doJson(q as Map<String, dynamic>))
            .toList();
      },
      erroPadrao: "Não foi possível carregar as quadras.",
    );
  }

  @override
  Future<Quadra> detalhe(String id) {
    return chamarApi(
      () async {
        final res = await _dio.get<Map<String, dynamic>>("/quadras/$id");
        return Quadra.doJson(res.data!);
      },
      erroPadrao: "Não foi possível carregar a quadra.",
    );
  }

  @override
  Future<Disponibilidade> disponibilidade(String quadraId, String data) {
    return chamarApi(
      () async {
        final res = await _dio.get<Map<String, dynamic>>(
          "/quadras/$quadraId/disponibilidade",
          queryParameters: {"data": data},
        );
        return Disponibilidade.doJson(res.data!);
      },
      erroPadrao: "Não foi possível carregar os horários.",
    );
  }
}
