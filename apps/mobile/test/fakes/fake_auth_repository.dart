// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "dart:async";

import "package:rally_mobile/features/auth/domain/auth_repository.dart";
import "package:rally_mobile/features/auth/domain/auth_user.dart";

/// Repositório de autenticação de mentira para os testes de widget.
///
/// Guarda os argumentos recebidos (para conferir o que a tela enviou) e
/// deixa o teste escolher o desfecho: sucesso, erro ou uma chamada que
/// nunca termina — esta última serve para observar o estado "enviando".
class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({this.sessaoInicial});

  /// Usuário devolvido por `currentUser()` — `null` simula app deslogado.
  final AuthUser? sessaoInicial;

  /// Erro lançado pelo próximo `register`, quando definido.
  AuthException? erroDeCadastro;

  /// Quando `true`, `register` fica pendente para sempre.
  bool cadastroPendente = false;

  /// Argumentos da última chamada a `register`.
  String? nomeRecebido;
  String? emailRecebido;
  String? senhaRecebida;
  bool? aceiteRecebido;
  int chamadasDeCadastro = 0;

  @override
  Future<AuthUser?> currentUser() async => sessaoInicial;

  @override
  Future<AuthUser> login({
    required String email,
    required String senha,
  }) async {
    return AuthUser(id: "u1", nome: "Jogador", email: email);
  }

  @override
  Future<AuthUser> register({
    required String nome,
    required String email,
    required String senha,
    required bool aceitouTermos,
  }) {
    chamadasDeCadastro++;
    nomeRecebido = nome;
    emailRecebido = email;
    senhaRecebida = senha;
    aceiteRecebido = aceitouTermos;

    if (cadastroPendente) return Completer<AuthUser>().future;
    if (erroDeCadastro != null) return Future.error(erroDeCadastro!);
    return Future.value(AuthUser(id: "u1", nome: nome, email: email));
  }

  /// Erro lancado pelo proximo `pedirLinkDeSenha`, quando definido.
  AuthException? erroDeRecuperacao;

  /// Quando `true`, `pedirLinkDeSenha` fica pendente para sempre.
  bool recuperacaoPendente = false;

  /// Argumentos da ultima chamada a `pedirLinkDeSenha`.
  String? emailDaRecuperacao;
  int chamadasDeRecuperacao = 0;

  @override
  Future<void> pedirLinkDeSenha({required String email}) {
    chamadasDeRecuperacao++;
    emailDaRecuperacao = email;

    if (recuperacaoPendente) return Completer<void>().future;
    if (erroDeRecuperacao != null) return Future.error(erroDeRecuperacao!);
    return Future.value();
  }

  /// `true` depois que a tela pediu para sair.
  bool saiu = false;

  @override
  Future<void> logout() async {
    saiu = true;
  }
}
