import "reserva.dart";

/// O que volta ao cancelar: a reserva já atualizada e se o cancelamento
/// entrou **dentro da janela** do estabelecimento (RN-02). Fora dela o
/// horário é liberado do mesmo jeito, mas sem direito a devolução.
class ResultadoCancelamento {
  const ResultadoCancelamento({
    required this.reserva,
    required this.dentroDoPrazo,
  });

  final Reserva reserva;
  final bool dentroDoPrazo;
}

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

  /// Cancela a reserva e libera o horário (RF-09).
  Future<ResultadoCancelamento> cancelar(String id, {String? motivo});

  /// Só em desenvolvimento: confirma o pagamento no lugar do webhook.
  Future<void> simularPagamento(String reservaId);
}
