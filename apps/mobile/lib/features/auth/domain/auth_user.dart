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
