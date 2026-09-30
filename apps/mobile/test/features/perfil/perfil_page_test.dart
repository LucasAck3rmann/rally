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
import "package:rally_mobile/features/perfil/presentation/perfil_page.dart";
import "package:rally_mobile/features/replays/presentation/replays_providers.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";

import "../../fakes/fake_auth_repository.dart";
import "../../fakes/fake_replays_repository.dart";
import "../../fakes/fake_reservas_repository.dart";

/// Perfil: identidade, números do jogador e o menu.
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

  Future<FakeAuthRepository> abrir(
    WidgetTester tester, {
    String nome = "Lucas Ackermann",
    List<dynamic> reservas = const [],
    int replays = 0,
  }) async {
    tester.view.physicalSize = const Size(1200, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final auth = FakeAuthRepository(
      sessaoInicial: AuthUser(id: "u1", nome: nome, email: "lucas@rally.com"),
    );

    final router = GoRouter(
      initialLocation: "/perfil",
      routes: [
        GoRoute(path: "/perfil", builder: (_, __) => const PerfilPage()),
        GoRoute(
          path: "/notificacoes",
          builder: (_, __) => const Scaffold(body: Text("tela de avisos")),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          reservasRepositoryProvider.overrideWithValue(
            FakeReservasRepository(reservas.cast()),
          ),
          replaysRepositoryProvider.overrideWithValue(
            FakeReplaysRepository([
              for (var i = 0; i < replays; i++) replayFalso(id: "rp$i"),
            ]),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
    return auth;
  }

  testWidgets("mostra o nome e as iniciais do jogador", (tester) async {
    await abrir(tester);

    await bombearAteSurgir(tester, find.text("Lucas Ackermann"));
    // Primeira e última letra do nome — "LA".
    expect(find.text("LA"), findsOneWidget);
  });

  testWidgets("um nome só vira uma inicial", (tester) async {
    await abrir(tester, nome: "Lucas");

    await bombearAteSurgir(tester, find.text("Lucas"));
    expect(find.text("L"), findsOneWidget);
  });

  testWidgets("conta quadras distintas, não reservas", (tester) async {
    // Três reservas, todas na mesma quadra: jogos = 3, mas quadras = 1.
    // Jogar de novo no mesmo lugar não conta como conhecer outra quadra.
    await abrir(
      tester,
      reservas: [
        reservaFalsa(id: "r1"),
        reservaFalsa(id: "r2"),
        reservaFalsa(id: "r3"),
      ],
      replays: 4,
    );

    await bombearAteSurgir(tester, find.text("Lucas Ackermann"));
    await bombearAteSurgir(tester, find.text("3"));
    expect(find.text("1"), findsOneWidget);
    expect(find.text("4"), findsOneWidget);
  });

  testWidgets("o item de notificações leva à tela de avisos", (tester) async {
    await abrir(tester);
    await bombearAteSurgir(tester, find.text("Notificações"));

    await tester.tap(find.text("Notificações"));
    await bombearAteSurgir(tester, find.text("tela de avisos"));
  });

  testWidgets("sair encerra a sessão", (tester) async {
    final auth = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Sair"));

    await tester.tap(find.text("Sair"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(auth.saiu, isTrue);
  });
}
