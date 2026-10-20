// SPDX-License-Identifier: AGPL-3.0-or-later
import "package:dio/dio.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "../config/app_config.dart";
import "../config/servidor_store.dart";
import "token_store.dart";

final secureStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore(ref.watch(secureStorageProvider)),
);

/// Cliente HTTP do app: base URL da API e Bearer token injetado em cada
/// requisição. Compartilhado por todas as features.
final dioProvider = Provider<Dio>((ref) {
  final tokens = ref.watch(tokenStoreProvider);
  final servidor = ref.watch(servidorStoreProvider);
  final dio = Dio(
    BaseOptions(
      // Valor inicial; o interceptor abaixo o substitui pelo escolhido.
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ),
  );
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        // O endereco e resolvido **a cada requisicao**, e nao na criacao do
        // Dio: quem troca o servidor na tela de entrada precisa que a
        // proxima chamada ja use o novo, sem reiniciar o aplicativo.
        options.baseUrl = await servidor.ler();
        final token = await tokens.read();
        if (token != null && token.isNotEmpty) {
          options.headers["Authorization"] = "Bearer $token";
        }
        handler.next(options);
      },
    ),
  );
  return dio;
});
