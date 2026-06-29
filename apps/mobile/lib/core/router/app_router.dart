import "package:flutter/foundation.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/auth/presentation/auth_controller.dart";
import "../../features/auth/presentation/login_page.dart";
import "../../features/home/presentation/home_page.dart";
import "../../features/splash/presentation/splash_page.dart";

/// Router com **guard de autenticação**:
/// - carregando (checando token) → `/splash`
/// - sem sessão → `/login`
/// - com sessão → `/home`
final appRouterProvider = Provider<GoRouter>((ref) {
  // Reavalia o redirect sempre que o estado de auth muda.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: "/splash",
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      if (auth.isLoading) {
        return loc == "/splash" ? null : "/splash";
      }
      final loggedIn = auth.valueOrNull != null;
      if (!loggedIn) {
        return loc == "/login" ? null : "/login";
      }
      if (loc == "/login" || loc == "/splash") {
        return "/home";
      }
      return null;
    },
    routes: [
      GoRoute(path: "/splash", builder: (_, __) => const SplashPage()),
      GoRoute(path: "/login", builder: (_, __) => const LoginPage()),
      GoRoute(path: "/home", builder: (_, __) => const HomePage()),
    ],
  );
});
