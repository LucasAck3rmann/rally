import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../features/auth/presentation/auth_controller.dart";
import "../../features/auth/presentation/cadastro_page.dart";
import "../../features/auth/presentation/login_page.dart";
import "../../features/gestao/presentation/agenda_page.dart";
import "../../features/gestao/presentation/painel_page.dart";
import "../../features/gestao/presentation/quadra_form_page.dart";
import "../../features/gestao/presentation/quadras_gestao_page.dart";
import "../../features/home/presentation/home_page.dart";
import "../../features/notificacoes/presentation/notificacoes_page.dart";
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

/// Telas que se abrem **sem sessão**: entrar e criar conta.
const rotasPublicas = {"/login", "/cadastro"};

/// Rotas do app do cliente com **guard de autenticação**:
/// - carregando (checando token) → `/splash`
/// - sem sessão → `/login` (ou `/cadastro`)
/// - com sessão → as abas (`/`, `/reservas`, `/replays`, `/perfil`)
///
/// O fluxo de reserva (detalhe → checkout → Pix → confirmação) e a área de
/// gestão (`/gestao`) ficam **fora** das abas, empilhados sobre elas, como
/// manda o desenho das telas.
final appRouterProvider = Provider<GoRouter>((ref) {
  // Reavalia o redirect sempre que o estado de auth muda.
  final refresh = ValueNotifier<int>(0);

  // O `/splash` cobre apenas a checagem do token guardado, no arranque.
  // Depois dela, um `AsyncLoading` é login ou cadastro em curso: a tela
  // precisa continuar montada para mostrar o spinner e, se falhar, o erro.
  var sessaoVerificada = false;
  ref.listen(authControllerProvider, (_, proximo) {
    if (!proximo.isLoading) sessaoVerificada = true;
    refresh.value++;
  });
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: _raiz,
    initialLocation: "/splash",
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      if (auth.isLoading && !sessaoVerificada) {
        return loc == "/splash" ? null : "/splash";
      }
      final logado = auth.valueOrNull != null;
      if (!logado) {
        return rotasPublicas.contains(loc) ? null : "/login";
      }
      if (rotasPublicas.contains(loc) || loc == "/splash") {
        return "/";
      }
      return null;
    },
    routes: [
      GoRoute(path: "/splash", builder: (_, __) => const SplashPage()),
      GoRoute(path: "/login", builder: (_, __) => const LoginPage()),
      GoRoute(path: "/cadastro", builder: (_, __) => const CadastroPage()),
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
              GoRoute(
                  path: "/replays", builder: (_, __) => const ReplaysPage()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(path: "/perfil", builder: (_, __) => const PerfilPage()),
            ],
          ),
        ],
      ),
      // Área do dono: entra pelo Perfil e fica empilhada sobre as abas,
      // porque gerir não é uma quinta aba do app do cliente.
      GoRoute(
        path: "/gestao",
        parentNavigatorKey: _raiz,
        builder: (_, __) => const GestaoPage(),
        routes: [
          GoRoute(
            path: ":estabelecimentoId/painel",
            parentNavigatorKey: _raiz,
            builder: (_, state) => PainelPage(
              estabelecimentoId: state.pathParameters["estabelecimentoId"]!,
            ),
          ),
          GoRoute(
            path: ":estabelecimentoId/agenda",
            parentNavigatorKey: _raiz,
            builder: (_, state) => AgendaPage(
              estabelecimentoId: state.pathParameters["estabelecimentoId"]!,
            ),
          ),
          GoRoute(
            path: ":estabelecimentoId/quadras",
            parentNavigatorKey: _raiz,
            builder: (_, state) => QuadrasGestaoPage(
              estabelecimentoId: state.pathParameters["estabelecimentoId"]!,
            ),
            routes: [
              // "nova" tem quatro segmentos e a edição tem cinco, então não
              // há ambiguidade com `:quadraId`.
              GoRoute(
                path: "nova",
                parentNavigatorKey: _raiz,
                builder: (_, state) => QuadraFormPage(
                  estabelecimentoId: state.pathParameters["estabelecimentoId"]!,
                ),
              ),
              GoRoute(
                path: ":quadraId/editar",
                parentNavigatorKey: _raiz,
                builder: (_, state) => QuadraFormPage(
                  estabelecimentoId: state.pathParameters["estabelecimentoId"]!,
                  quadraId: state.pathParameters["quadraId"],
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: "/notificacoes",
        parentNavigatorKey: _raiz,
        builder: (_, __) => const NotificacoesPage(),
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
