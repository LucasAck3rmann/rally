import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/replay.dart";
import "../domain/replays_repository.dart";

class ReplaysRepositoryImpl implements ReplaysRepository {
  const ReplaysRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<Replay>> meus(PeriodoReplay periodo) {
    return chamarApi(
      () async {
        final res = await _dio.get<List<dynamic>>(
          "/replays/meus",
          queryParameters: {"periodo": periodo.valor},
        );
        return (res.data ?? const [])
            .map((r) => Replay.doJson(r as Map<String, dynamic>))
            .toList();
      },
      erroPadrao: "Não foi possível carregar seus replays.",
    );
  }
}
