import "../domain/auth_repository.dart";
import "../domain/auth_user.dart";
import "token_store.dart";

/// Implementação **stub**: valida na borda e simula a chamada de rede,
/// guardando um token de exemplo no armazenamento seguro.
///
/// TODO(M3): substituir pelo `POST /api/v1/auth/login` (via Dio), tratamento
/// de erros do gateway e refresh de token.
class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._tokens);

  final TokenStore _tokens;

  @override
  Future<AuthUser> login({required String email, required String senha}) async {
    if (!email.contains("@") || senha.length < 6) {
      throw const AuthException("E-mail ou senha inválidos.");
    }
    await Future<void>.delayed(const Duration(milliseconds: 600));
    await _tokens.save("stub.${DateTime.now().millisecondsSinceEpoch}");
    return AuthUser(id: "stub", nome: _nomeDoEmail(email), email: email);
  }

  @override
  Future<void> logout() => _tokens.clear();

  @override
  Future<AuthUser?> currentUser() async {
    final token = await _tokens.read();
    if (token == null) return null;
    return const AuthUser(id: "stub", nome: "Jogador", email: "");
  }

  String _nomeDoEmail(String email) {
    final base = email.split("@").first;
    if (base.isEmpty) return "Jogador";
    return base[0].toUpperCase() + base.substring(1);
  }
}
