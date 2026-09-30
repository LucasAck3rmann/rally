// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/features/auth/domain/auth_user.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/auth/presentation/cadastro_page.dart";
import "package:rally_mobile/features/auth/presentation/login_page.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";
import "package:rally_mobile/features/gestao/presentation/quadra_form_page.dart";
import "package:rally_mobile/features/gestao/presentation/quadras_gestao_page.dart";
import "package:rally_mobile/features/home/presentation/home_page.dart";
import "package:rally_mobile/features/notificacoes/presentation/notificacoes_page.dart";
import "package:rally_mobile/features/notificacoes/presentation/notificacoes_providers.dart";
import "package:rally_mobile/features/perfil/presentation/perfil_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadra_detalhe_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadras_providers.dart";
import "package:rally_mobile/features/replays/presentation/replays_page.dart";
import "package:rally_mobile/features/replays/presentation/replays_providers.dart";
import "package:rally_mobile/features/reservas/domain/reserva.dart";
import "package:rally_mobile/features/reservas/presentation/checkout_page.dart";
import "package:rally_mobile/features/reservas/presentation/confirmacao_page.dart";
import "package:rally_mobile/features/reservas/presentation/minhas_reservas_page.dart";
import "package:rally_mobile/features/reservas/presentation/pagamento_pix_page.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";
import "package:rally_mobile/features/splash/presentation/splash_page.dart";

import "../fakes/fake_auth_repository.dart";
import "../fakes/fake_gestao_repository.dart" as gestao;
import "../fakes/fake_notificacoes_repository.dart";
import "../fakes/fake_quadras_repository.dart";
import "../fakes/fake_replays_repository.dart";
import "../fakes/fake_reservas_repository.dart";

/// **Texto ampliado do sistema, em todas as telas.**
///
/// Até 30/09 o app foi verificado num eixo só — largura de tela, a 360px.
/// Passava, e continuava quebrando para quem aumenta a fonte do aparelho:
/// nove estouros de layout em três dias, os três últimos visíveis apenas
/// aqui. Aumentar a fonte é o ajuste de acessibilidade mais usado, e um app
/// de reserva de quadra atende gente de todas as idades.
///
/// Cada teste só **renderiza** a tela: qualquer `RenderFlex` estourado vira
/// exceção e derruba a suíte sozinho, sem precisar de asserção.
void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    await initializeDateFormatting("pt_BR");
  });

  Future<void> bombearAteSurgir(
    WidgetTester tester,
    Finder alvo, {
    int maximo = 40,
  }) async {
    for (var i = 0; i < maximo; i++) {
      if (alvo.evaluate().isNotEmpty) return;
      await tester.pump(const Duration(milliseconds: 50));
    }
    fail("O alvo não apareceu depois de $maximo quadros: $alvo");
  }

  final quadra = quadraFalsa(
    modalidades: const ["Beach tennis", "Futevôlei"],
  );

  /// Monta [tela] no pior caso combinado: a tela mais estreita que o app
  /// atende **e** o texto do sistema uma vez e meia maior.
  Future<void> abrir(WidgetTester tester, Widget tela) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.5;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: "/tela",
      routes: [
        GoRoute(path: "/tela", builder: (_, __) => tela),
        // Destino genérico para as telas que empilham algo.
        GoRoute(
          path: "/adiante",
          builder: (_, __) => const Scaffold(body: Text("adiante")),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(
            FakeAuthRepository(
              sessaoInicial: const AuthUser(
                id: "u1",
                nome: "Lucas Ackermann",
                email: "lucas@rally.com.br",
              ),
            ),
          ),
          quadrasRepositoryProvider.overrideWithValue(
            FakeQuadrasRepository(
              quadras: [quadra],
              slots: [slotFalso(19), slotFalso(20, disponivel: false)],
            ),
          ),
          promocaoDestaqueProvider.overrideWith((ref) async => null),
          reservasRepositoryProvider.overrideWithValue(
            FakeReservasRepository([
              reservaFalsa(pagamento: pagamentoFalso()),
              reservaFalsa(id: "r2", status: ReservaStatus.concluida),
            ]),
          ),
          replaysRepositoryProvider.overrideWithValue(
            FakeReplaysRepository([
              replayFalso(id: "rp1"),
              replayFalso(id: "rp2", titulo: "Defesa no fundo da quadra"),
            ]),
          ),
          notificacoesRepositoryProvider.overrideWithValue(
            FakeNotificacoesRepository([
              avisoFalso(id: "n1"),
              avisoFalso(id: "n2", idadeEmDias: 3, lida: true),
            ]),
          ),
          gestaoRepositoryProvider.overrideWithValue(
            gestao.FakeGestaoRepository(
              estabelecimentos: [
                gestao.estabelecimentoFalso(id: "e1"),
                gestao.estabelecimentoFalso(id: "e2", nome: "Arena Centro"),
              ],
              quadras: [
                gestao.quadraFalsa(faixas: 2),
                gestao.quadraFalsa(id: "q2", nome: "Quadra 2", ativo: false),
              ],
            ),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
  }

  testWidgets("Home", (tester) async {
    await abrir(tester, const Scaffold(body: HomePage()));
    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));
  });

  testWidgets("detalhe da quadra", (tester) async {
    await abrir(tester, const QuadraDetalhePage(quadraId: "q1"));
    await bombearAteSurgir(tester, find.text("19:00"));
  });

  testWidgets("checkout", (tester) async {
    await abrir(
      tester,
      CheckoutPage(argumentos: (quadra: quadra, slot: slotFalso(19))),
    );
    await bombearAteSurgir(tester, find.byType(CheckoutPage));
  });

  testWidgets("pagamento Pix", (tester) async {
    await abrir(tester, const PagamentoPixPage(reservaId: "r1"));
    await bombearAteSurgir(tester, find.byType(PagamentoPixPage));
  });

  testWidgets("confirmação", (tester) async {
    await abrir(tester, const ConfirmacaoPage(reservaId: "r1"));
    await bombearAteSurgir(tester, find.byType(ConfirmacaoPage));
  });

  testWidgets("minhas reservas", (tester) async {
    await abrir(tester, const Scaffold(body: MinhasReservasPage()));
    await bombearAteSurgir(tester, find.text("Arena Beira-Rio"));
  });

  testWidgets("replays", (tester) async {
    await abrir(tester, const Scaffold(body: ReplaysPage()));
    await bombearAteSurgir(tester, find.text("Ponto do jogo"));
  });

  testWidgets("perfil", (tester) async {
    await abrir(tester, const Scaffold(body: PerfilPage()));
    await bombearAteSurgir(tester, find.text("Lucas Ackermann"));
  });

  testWidgets("notificações", (tester) async {
    await abrir(tester, const NotificacoesPage());
    await bombearAteSurgir(tester, find.text("Pagamento confirmado"));
  });

  testWidgets("login", (tester) async {
    await abrir(tester, const LoginPage());
    await bombearAteSurgir(tester, find.byType(LoginPage));
  });

  testWidgets("cadastro", (tester) async {
    await abrir(tester, const CadastroPage());
    await bombearAteSurgir(tester, find.byType(CadastroPage));
  });

  testWidgets("splash", (tester) async {
    await abrir(tester, const SplashPage());
    await bombearAteSurgir(tester, find.byType(SplashPage));
  });

  testWidgets("gestão — seletor de estabelecimento", (tester) async {
    await abrir(tester, const GestaoPage());
    await bombearAteSurgir(tester, find.text("Arena Centro"));
  });

  testWidgets("gestão — quadras", (tester) async {
    await abrir(tester, const QuadrasGestaoPage(estabelecimentoId: "e1"));
    await bombearAteSurgir(tester, find.text("Quadra 2"));
  });

  testWidgets("gestão — nova quadra", (tester) async {
    await abrir(tester, const QuadraFormPage(estabelecimentoId: "e1"));
    await bombearAteSurgir(tester, find.text("Nova quadra"));
  });

  testWidgets("gestão — editar quadra", (tester) async {
    await abrir(
      tester,
      const QuadraFormPage(estabelecimentoId: "e1", quadraId: "q1"),
    );
    await bombearAteSurgir(tester, find.text("Editar quadra"));
  });
}
