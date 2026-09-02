import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../domain/reserva.dart";
import "../domain/reservas_repository.dart";

/// Conversa com `/reservas` na API (todas as rotas exigem o Bearer token,
/// injetado pelo interceptor do Dio).
class ReservasRepositoryImpl implements ReservasRepository {
  const ReservasRepositoryImpl(this._dio);

  final Dio _dio;

  @override
  Future<List<Reserva>> minhas() {
    return chamarApi(
      () async {
        final res = await _dio.get<List<dynamic>>("/reservas/minhas");
        return (res.data ?? const [])
            .map((r) => Reserva.doJson(r as Map<String, dynamic>))
            .toList();
      },
      erroPadrao: "Não foi possível carregar suas reservas.",
    );
  }

  @override
  Future<Reserva> detalhe(String id) {
    return chamarApi(
      () async {
        final res = await _dio.get<Map<String, dynamic>>("/reservas/$id");
        return Reserva.doJson(res.data!);
      },
      erroPadrao: "Não foi possível carregar a reserva.",
    );
  }

  @override
  Future<Reserva> criar({
    required String quadraId,
    required DateTime inicio,
    required DateTime fim,
    required String metodo,
  }) {
    return chamarApi(
      () async {
        final res = await _dio.post<Map<String, dynamic>>(
          "/reservas",
          data: {
            "quadraId": quadraId,
            "inicio": inicio.toUtc().toIso8601String(),
            "fim": fim.toUtc().toIso8601String(),
            "metodo": metodo,
          },
        );
        return Reserva.doJson(res.data!);
      },
      erroPadrao: "Não foi possível abrir a reserva.",
    );
  }

  @override
  Future<void> simularPagamento(String reservaId) {
    return chamarApi(
      () => _dio.post<Map<String, dynamic>>(
        "/reservas/$reservaId/simular-pagamento",
      ),
      erroPadrao: "Não foi possível confirmar o pagamento.",
    );
  }
}
