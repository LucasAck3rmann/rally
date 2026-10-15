// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:rally_mobile/core/network/token_store.dart";

/// `TokenStore` em memória, para testar o repositório de autenticação.
///
/// O real escreve no Keychain e no Keystore por canal de plataforma, que não
/// existe em teste de unidade. Implementar a classe em vez de dublar o
/// `FlutterSecureStorage` mantém o dublê na fronteira do projeto, e não na do
/// pacote de terceiro — se o armazenamento seguro trocar de biblioteca, este
/// arquivo não muda.
class TokenStoreFalso implements TokenStore {
  TokenStoreFalso({String? inicial}) : _token = inicial;

  String? _token;

  /// Quantas vezes o token foi apagado — é o que distingue "sessão expirada"
  /// de "falhou a rede" no `currentUser`.
  int limpezas = 0;

  String? get token => _token;

  @override
  Future<void> save(String token) async => _token = token;

  @override
  Future<String?> read() async => _token;

  @override
  Future<void> clear() async {
    limpezas++;
    _token = null;
  }
}
