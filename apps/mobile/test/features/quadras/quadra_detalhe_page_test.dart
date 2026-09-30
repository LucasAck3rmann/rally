// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/quadras/presentation/agenda_widgets.dart";
import "package:rally_mobile/features/quadras/presentation/quadra_detalhe_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadras_providers.dart";

import "../../fakes/fake_quadras_repository.dart";

/// Detalhe da quadra: escolher dia e horário antes do checkout.
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

  Future<void> abrir(WidgetTester tester, FakeQuadrasRepository repo) async {
    tester.view.physicalSize = const Size(1200, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: "/quadras/q1",
      routes: [
        GoRoute(
          path: "/quadras/:id",
          builder: (_, state) =>
              QuadraDetalhePage(quadraId: state.pathParameters["id"]!),
          routes: [
            GoRoute(
              path: "checkout",
              builder: (_, __) =>
                  const Scaffold(body: Text("tela de checkout")),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [quadrasRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await bombearAteSurgir(tester, find.byType(QuadraDetalhePage));
  }

  testWidgets("mostra a quadra e a grade do dia", (tester) async {
    await abrir(
      tester,
      FakeQuadrasRepository(
        quadras: [quadraFalsa()],
        slots: [slotFalso(19), slotFalso(20)],
      ),
    );

    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));
    // A grade chega por outro Future; esperar por ela é parte do teste.
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "19:00"));
    expect(find.widgetWithText(CartaoSlot, "20:00"), findsOneWidget);
  });

  testWidgets("a reserva só libera depois de escolher o horário", (
    tester,
  ) async {
    await abrir(
      tester,
      FakeQuadrasRepository(quadras: [quadraFalsa()], slots: [slotFalso(19)]),
    );
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "19:00"));

    // Antes de escolher, a barra convida a escolher em vez de reservar.
    expect(find.text("Escolha um horário"), findsOneWidget);

    await tester.tap(find.widgetWithText(CartaoSlot, "19:00"));
    await bombearAteSurgir(tester, find.text("Reservar 19:00"));
  });

  testWidgets("horário ocupado não pode ser escolhido", (tester) async {
    await abrir(
      tester,
      FakeQuadrasRepository(
        quadras: [quadraFalsa()],
        slots: [slotFalso(21, disponivel: false)],
      ),
    );
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "21:00"));

    await tester.tap(find.widgetWithText(CartaoSlot, "21:00"));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text("Escolha um horário"), findsOneWidget);
  });

  testWidgets("o preço da barra segue o slot escolhido", (tester) async {
    // A faixa de horário pode cobrar diferente do preço-base da quadra
    // (RN-04); a barra tem de mostrar o do horário, não o da vitrine.
    await abrir(
      tester,
      FakeQuadrasRepository(
        quadras: [quadraFalsa(precoHora: 80)],
        slots: [slotFalso(19, preco: 120)],
      ),
    );
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "19:00"));

    await tester.tap(find.widgetWithText(CartaoSlot, "19:00"));
    await bombearAteSurgir(tester, find.text("R\$ 120"));
  });

  testWidgets("trocar de dia consulta a grade de novo", (tester) async {
    final repo = FakeQuadrasRepository(
      quadras: [quadraFalsa()],
      slots: [slotFalso(19)],
    );
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "19:00"));

    final diasAntes = repo.diasConsultados.length;
    // O segundo cartão do seletor é amanhã.
    await tester.tap(find.byType(CartaoDia).at(1));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.diasConsultados.length, greaterThan(diasAntes));
    expect(repo.diasConsultados.last, isNot(repo.diasConsultados.first));
  });

  testWidgets("dia sem funcionamento mostra o vazio", (tester) async {
    await abrir(
      tester,
      FakeQuadrasRepository(quadras: [quadraFalsa()], slots: const []),
    );

    await bombearAteSurgir(tester, find.text("Sem horários nesse dia"));
  });

  testWidgets("mostra o erro da API", (tester) async {
    final repo = FakeQuadrasRepository(quadras: [quadraFalsa()])
      ..erro = const ApiException("Sem conexão com o servidor.");
    await abrir(tester, repo);

    await bombearAteSurgir(tester, find.text("Sem conexão com o servidor."));
  });
}
