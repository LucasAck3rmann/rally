import "package:flutter_riverpod/flutter_riverpod.dart";

import "../domain/auth_user.dart";
import "auth_providers.dart";

/// Estado de autenticação do app.
/// `build` checa o token guardado (loading enquanto isso); depois é `AuthUser?`.
class AuthController extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() {
    return ref.read(authRepositoryProvider).currentUser();
  }

  Future<void> login(String email, String senha) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authRepositoryProvider).login(email: email, senha: senha),
    );
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(null);
  }
}

final authControllerProvider =
    AsyncNotifierProvider<AuthController, AuthUser?>(AuthController.new);
