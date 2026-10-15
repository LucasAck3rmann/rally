// SPDX-License-Identifier: AGPL-3.0-or-later
import "package:dio/dio.dart";

import "../../../core/network/erro_api.dart";
import "../../../core/network/token_store.dart";
import "../domain/auth_repository.dart";
import "../domain/auth_user.dart";

/// Implementação que fala com a API do Rally (`/auth/*`):
/// faz login, cria conta, guarda o token (seguro) e recupera a sessão atual.
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
      return await _saveAndParse(res.data);
    } on DioException catch (e) {
      throw AuthException(mensagemDeDio(e,
          padrao: "Não foi possível entrar. Tente novamente."));
    }
  }

  @override
  Future<AuthUser> register({
    required String nome,
    required String email,
    required String senha,
    required bool aceitouTermos,
  }) async {
    try {
      // A API devolve o mesmo envelope do login, então o cadastro já
      // entra com a sessão aberta — o cliente não digita a senha duas vezes.
      final res = await _dio.post<Map<String, dynamic>>(
        "/auth/register",
        data: {
          "nome": nome,
          "email": email,
          "senha": senha,
          "aceitouTermos": aceitouTermos,
        },
      );
      return await _saveAndParse(res.data);
    } on DioException catch (e) {
      throw AuthException(
        mensagemDeDio(e,
            padrao: "Não foi possível criar a conta. Tente novamente."),
      );
    }
  }

  @override
  Future<void> pedirLinkDeSenha({required String email}) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        "/auth/recuperar-senha",
        data: {"email": email},
      );
    } on DioException catch (e) {
      // 400 e formato invalido, que o campo ja barra. Qualquer outra falha
      // vira mensagem generica: nenhuma delas pode virar "esse e-mail nao
      // existe", porque a API nao diz isso e a tela nao pode inventar.
      throw AuthException(
        mensagemDeDio(e,
            padrao: "Nao foi possivel enviar agora. Tente novamente."),
      );
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
    } on DioException catch (e) {
      // **Só o 401 apaga o token.** Antes, qualquer `DioException` apagava — e
      // falta de rede é uma `DioException`. O efeito era que abrir o
      // aplicativo no metrô, ou com a API fora do ar, **deslogava a pessoa de
      // forma permanente**: ela recuperava a conexão e ainda precisava
      // digitar a senha outra vez.
      //
      // Falta de rede, tempo esgotado e 500 não dizem nada sobre a validade
      // da credencial. Só o 401 diz. Nos outros casos devolve `null` — a
      // sessão não pôde ser **confirmada** agora — mas o token fica guardado
      // para a próxima tentativa.
      if (e.response?.statusCode == 401) {
        await _tokens.clear();
      }
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
}
