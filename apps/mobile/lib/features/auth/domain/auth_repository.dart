import "auth_user.dart";

/// Contrato de autenticação (a implementação fica em `data/`).
abstract interface class AuthRepository {
  Future<AuthUser> login({required String email, required String senha});
  Future<void> logout();

  /// Usuário da sessão atual, ou `null` se não autenticado.
  Future<AuthUser?> currentUser();
}

/// Erro de autenticação com mensagem amigável para a UI.
class AuthException implements Exception {
  const AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}
