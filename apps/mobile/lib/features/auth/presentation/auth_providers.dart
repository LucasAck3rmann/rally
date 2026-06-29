import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "../data/auth_repository_impl.dart";
import "../data/token_store.dart";
import "../domain/auth_repository.dart";

final secureStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore(ref.watch(secureStorageProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(ref.watch(tokenStoreProvider)),
);
