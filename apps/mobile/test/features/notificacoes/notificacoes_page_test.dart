// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/notificacoes/presentation/notificacoes_page.dart";
import "package:rally_mobile/features/notificacoes/presentation/notificacoes_providers.dart";

import "../../fakes/fake_notificacoes_repository.dart";

/// Caixa de avisos (RF-16).
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

  Future<void> abrir(
    WidgetTester tester,
    FakeNotificacoesRepository repo,
  ) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    // Router mínimo: a tela usa `context.push` no destino do aviso.
    final router = GoRouter(
      initialLocation: "/notificacoes",
      routes: [
        GoRoute(
          path: "/notificacoes",
          builder: (_, __) => const NotificacoesPage(),
        ),
        GoRoute(
          path: "/reservas/:id/confirmacao",
          builder: (_, __) => const Scaffold(body: Text("tela de confirmação")),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificacoesRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await bombearAteSurgir(tester, find.text("Avisos"));
  }

  testWidgets("agrupa os avisos por período", (tester) async {
    await abrir(
      tester,
      FakeNotificacoesRepository([
        avisoFalso(id: "n1", titulo: "Pagamento confirmado"),
        avisoFalso(id: "n2", titulo: "Replay pronto", idadeEmDias: 3),
        avisoFalso(id: "n3", titulo: "Promoção de terça", idadeEmDias: 30),
      ]),
    );

    await bombearAteSurgir(tester, find.text("HOJE"));
    expect(find.text("ESTA SEMANA"), findsOneWidget);
    expect(find.text("ANTES"), findsOneWidget);
  });

  testWidgets("conta as não lidas no resumo", (tester) async {
    await abrir(
      tester,
      FakeNotificacoesRepository([
        avisoFalso(id: "n1"),
        avisoFalso(id: "n2", lida: true),
      ]),
    );

    await bombearAteSurgir(tester, find.text("1 aviso não lido"));
  });

  testWidgets("marca todas como lidas e some com o botão", (tester) async {
    final repo = FakeNotificacoesRepository([
      avisoFalso(id: "n1"),
      avisoFalso(id: "n2"),
    ]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("2 avisos não lidos"));

    await tester.tap(find.widgetWithText(TextButton, "Marcar lidas"));
    await bombearAteSurgir(tester, find.text("Tudo em dia por aqui"));

    expect(repo.chamadasLerTodas, 1);
    // Sem não lidas, a ação não faz mais sentido e sai da tela.
    expect(find.widgetWithText(TextButton, "Marcar lidas"), findsNothing);
  });

  testWidgets("tocar marca como lido e leva ao destino", (tester) async {
    final repo = FakeNotificacoesRepository([
      avisoFalso(id: "n1", destino: "/reservas/r1/confirmacao"),
    ]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Pagamento confirmado"));

    await tester.tap(find.text("Pagamento confirmado"));
    await bombearAteSurgir(tester, find.text("tela de confirmação"));

    expect(repo.marcadas, ["n1"]);
  });

  testWidgets("não chama a API de novo ao tocar num aviso já lido", (
    tester,
  ) async {
    final repo = FakeNotificacoesRepository([
      avisoFalso(id: "n1", lida: true, destino: "/reservas/r1/confirmacao"),
    ]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Pagamento confirmado"));

    await tester.tap(find.text("Pagamento confirmado"));
    await bombearAteSurgir(tester, find.text("tela de confirmação"));

    expect(repo.marcadas, isEmpty);
  });

  testWidgets("mostra o vazio quando não há avisos", (tester) async {
    await abrir(tester, FakeNotificacoesRepository([]));

    await bombearAteSurgir(tester, find.text("Nenhum aviso ainda"));
  });

  testWidgets("mostra o erro da API com opção de tentar de novo", (
    tester,
  ) async {
    final repo = FakeNotificacoesRepository([])
      ..erroAoCarregar = const ApiException("Sem conexão com o servidor.");

    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [notificacoesRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: NotificacoesPage()),
      ),
    );

    await bombearAteSurgir(tester, find.text("Sem conexão com o servidor."));
  });
}
