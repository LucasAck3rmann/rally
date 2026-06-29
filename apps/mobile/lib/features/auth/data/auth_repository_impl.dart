import "package:dio/dio.dart";

import "../domain/auth_repository.dart";
import "../domain/auth_user.dart";
import "token_store.dart";

/// Implementação que fala com a API do Rally (`/auth/*`):
/// faz login, guarda o token (seguro) e recupera a sessão atual.
class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._dio, this._tokens);

  final Dio _dio;
  final TokenStore _tokens;

  @override
  Future<AuthUser> login({required String email, required String senha}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        "/auth/login",
        data: {"email": email, "senha": senha},
      );
      return _saveAndParse(res.data);
    } on DioException catch (e) {
      throw AuthException(_messageFromDio(e));
    }
  }

  @override
  Future<void> logout() => _tokens.clear();

  @override
  Future<AuthUser?> currentUser() async {
    final token = await _tokens.read();
    if (token == null || token.isEmpty) return null;
    try {
      final res = await _dio.get<Map<String, dynamic>>("/auth/me");
      return _userFromJson(res.data);
    } on DioException {
      // Token inválido/expirado: limpa e considera deslogado.
      await _tokens.clear();
      return null;
    }
  }

  Future<AuthUser> _saveAndParse(Map<String, dynamic>? body) async {
    final token = body?["accessToken"] as String?;
    if (token == null || token.isEmpty) {
      throw const AuthException("Resposta inválida do servidor.");
    }
    await _tokens.save(token);
    return _userFromJson(body?["user"] as Map<String, dynamic>?);
  }

  AuthUser _userFromJson(Map<String, dynamic>? user) {
    if (user == null) {
      throw const AuthException("Usuário ausente na resposta.");
    }
    return AuthUser(
      id: user["id"] as String? ?? "",
      nome: user["nome"] as String? ?? "Jogador",
      email: user["email"] as String? ?? "",
    );
  }

  String _messageFromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final msg = data["message"];
      if (msg is String) return msg;
      if (msg is List && msg.isNotEmpty) return msg.first.toString();
    }
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return "Sem conexão com o servidor.";
    }
    return "Não foi possível entrar. Tente novamente.";
  }
}
