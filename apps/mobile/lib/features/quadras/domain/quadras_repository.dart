import "quadra.dart";

/// Contrato da vitrine de quadras (implementação em `data/`).
abstract interface class QuadrasRepository {
  /// Quadras da Home, com filtro opcional de modalidade e busca por texto.
  Future<List<Quadra>> listar({String? modalidade, String? busca});

  Future<Quadra> detalhe(String id);

  /// Grade de horários de um dia (`data` no formato YYYY-MM-DD).
  Future<Disponibilidade> disponibilidade(String quadraId, String data);
}
