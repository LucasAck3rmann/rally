import "auth_user.dart";

/// Contrato de autenticação (a implementação fica em `data/`).
abstract interface class AuthRepository {
  Future<AuthUser> login({required String email, required String senha});

  /// Cria a conta do cliente e já devolve a sessão aberta (RF-01).
  Future<AuthUser> register({
    required String nome,
    required String email,
    required String senha,
  });

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
