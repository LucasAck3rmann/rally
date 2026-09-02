import "reserva.dart";

/// Contrato das reservas do cliente autenticado.
abstract interface class ReservasRepository {
  Future<List<Reserva>> minhas();

  Future<Reserva> detalhe(String id);

  /// Abre a reserva e gera a cobrança. `metodo` = "PIX" ou "CARTAO".
  Future<Reserva> criar({
    required String quadraId,
    required DateTime inicio,
    required DateTime fim,
    required String metodo,
  });

  /// Só em desenvolvimento: confirma o pagamento no lugar do webhook.
  Future<void> simularPagamento(String reservaId);
}
