import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/promocao.dart";

/// Busca a promoção em destaque (`null` quando não há nenhuma no ar).
class PromocoesRepository {
  const PromocoesRepository(this._dio);

  final Dio _dio;

  Future<PromocaoDestaque?> destaque() {
    return chamarApi(
      () async {
        final res = await _dio.get<dynamic>("/promocoes/destaque");
        final dados = res.data;
        if (dados is! Map<String, dynamic>) return null;
        return PromocaoDestaque.doJson(dados);
      },
      erroPadrao: "Não foi possível carregar a promoção.",
    );
  }
}
