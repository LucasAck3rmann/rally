// SPDX-License-Identifier: AGPL-3.0-or-later
/// Usuário autenticado (modelo de domínio).
class AuthUser {
  const AuthUser({
    required this.id,
    required this.nome,
    required this.email,
  });

  final String id;
  final String nome;
  final String email;
}
