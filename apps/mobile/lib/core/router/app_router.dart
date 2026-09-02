import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/auth/presentation/auth_controller.dart";
import "../../features/auth/presentation/login_page.dart";
import "../../features/home/presentation/home_page.dart";
import "../../features/perfil/presentation/perfil_page.dart";
import "../../features/quadras/presentation/quadra_detalhe_page.dart";
import "../../features/replays/presentation/replays_page.dart";
import "../../features/reservas/presentation/checkout_page.dart";
import "../../features/reservas/presentation/confirmacao_page.dart";
import "../../features/reservas/presentation/minhas_reservas_page.dart";
import "../../features/reservas/presentation/pagamento_pix_page.dart";
import "../../features/shell/presentation/app_shell.dart";
import "../../features/splash/presentation/splash_page.dart";

final _raiz = GlobalKey<NavigatorState>();

/// Rotas do app do cliente com **guard de autenticação**:
/// - carregando (checando token) → `/splash`
/// - sem sessão → `/login`
/// - com sessão → as abas (`/`, `/reservas`, `/replays`, `/perfil`)
///
/// O fluxo de reserva (detalhe → checkout → Pix → confirmação) fica **fora**
/// das abas, empilhado sobre elas, como manda o desenho das telas.
final appRouterProvider = Provider<GoRouter>((ref) {
  // Reavalia o redirect sempre que o estado de auth muda.
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _raiz,
    initialLocation: "/splash",
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      if (auth.isLoading) {
        return loc == "/splash" ? null : "/splash";
      }
      final logado = auth.valueOrNull != null;
      if (!logado) {
        return loc == "/login" ? null : "/login";
      }
      if (loc == "/login" || loc == "/splash") {
        return "/";
      }
      return null;
    },
    routes: [
      GoRoute(path: "/splash", builder: (_, __) => const SplashPage()),
      GoRoute(path: "/login", builder: (_, __) => const LoginPage()),

      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => AppShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(
            routes: [GoRoute(path: "/", builder: (_, __) => const HomePage())],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: "/reservas",
                builder: (_, __) => const MinhasReservasPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/replays", builder: (_, __) => const ReplaysPage()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/perfil", builder: (_, __) => const PerfilPage()),
            ],
          ),
        ],
      ),

      GoRoute(
        path: "/quadras/:id",
        parentNavigatorKey: _raiz,
        builder: (_, state) =>
            QuadraDetalhePage(quadraId: state.pathParameters["id"]!),
        routes: [
          GoRoute(
            path: "checkout",
            parentNavigatorKey: _raiz,
            builder: (_, state) {
              // A quadra e o slot já estão carregados na tela anterior;
              // passá-los adiante evita uma segunda ida à API.
              final argumentos = state.extra as ArgumentosCheckout;
              return CheckoutPage(argumentos: argumentos);
            },
          ),
        ],
      ),
      GoRoute(
        path: "/reservas/:id/pagamento",
        parentNavigatorKey: _raiz,
        builder: (_, state) =>
            PagamentoPixPage(reservaId: state.pathParameters["id"]!),
      ),
      GoRoute(
        path: "/reservas/:id/confirmacao",
        parentNavigatorKey: _raiz,
        builder: (_, state) =>
            ConfirmacaoPage(reservaId: state.pathParameters["id"]!),
      ),
    ],
  );
});
