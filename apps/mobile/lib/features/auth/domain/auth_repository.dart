// SPDX-License-Identifier: AGPL-3.0-or-later
import "auth_user.dart";

/// Contrato de autenticação (a implementação fica em `data/`).
abstract interface class AuthRepository {
  Future<AuthUser> login({required String email, required String senha});

  /// Cria a conta do cliente e já devolve a sessão aberta (RF-01).
  Future<AuthUser> register({
    required String nome,
    required String email,
    required String senha,
    required bool aceitouTermos,
  });

  /// Pede o link de redefinicao de senha (RF-03).
  ///
  /// Nao devolve nada e nao distingue e-mail cadastrado de nao cadastrado: a
  /// API responde igual nos dois casos, de proposito, e repassar a diferenca
  /// para a tela entregaria uma lista de clientes a quem fosse tentando
  /// enderecos.
  Future<void> pedirLinkDeSenha({required String email});

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
