// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/reservas/presentation/checkout_page.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";

import "../../fakes/fake_quadras_repository.dart";
import "../../fakes/fake_reservas_repository.dart";

/// Checkout: é aqui que o cliente vê o que vai pagar.
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
    FakeReservasRepository repo, {
    double precoHora = 80,
    double descontoPixPct = 5,
  }) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final quadra = quadraFalsa(
      precoHora: precoHora,
      estabelecimento: estabelecimentoFalso(descontoPixPct: descontoPixPct),
    );
    final argumentos = (quadra: quadra, slot: slotFalso(19, preco: precoHora));

    final router = GoRouter(
      initialLocation: "/checkout",
      routes: [
        GoRoute(
          path: "/checkout",
          builder: (_, __) => CheckoutPage(argumentos: argumentos),
        ),
        GoRoute(
          path: "/reservas/:id/pagamento",
          builder: (_, __) => const Scaffold(body: Text("tela do Pix")),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [reservasRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await bombearAteSurgir(tester, find.byType(CheckoutPage));
  }

  testWidgets("aplica o desconto do Pix no total", (tester) async {
    await abrir(tester, FakeReservasRepository([]));

    // 80 com 5% = 4 de desconto, 76 a pagar. `Formato.moeda` omite os
    // centavos quando o valor é redondo.
    expect(find.text("R\$ 80"), findsWidgets);
    expect(find.text("Desconto Pix (5%)"), findsOneWidget);
    expect(find.text("- R\$ 4"), findsOneWidget);
    expect(find.text("R\$ 76"), findsWidgets);
  });

  testWidgets("no cartão não há desconto", (tester) async {
    await abrir(tester, FakeReservasRepository([]));

    await tester.tap(find.text("Cartão de crédito"));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.textContaining("- R\$"), findsNothing);
    expect(find.text("Pagar no cartão"), findsOneWidget);
  });

  testWidgets("sem desconto configurado o total é o preço cheio", (
    tester,
  ) async {
    await abrir(tester, FakeReservasRepository([]), descontoPixPct: 0);

    expect(find.textContaining("- R\$"), findsNothing);
  });

  testWidgets("manda o método escolhido para a API", (tester) async {
    final repo = FakeReservasRepository([]);
    await abrir(tester, repo);

    await tester.tap(find.text("Cartão de crédito"));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.tap(find.text("Pagar no cartão"));
    await bombearAteSurgir(tester, find.text("tela do Pix"));

    expect(repo.criacao?.metodo, "CARTAO");
    expect(repo.criacao?.quadraId, "q1");
  });

  testWidgets("horário tomado (409) oferece voltar para a grade", (
    tester,
  ) async {
    // É o lado visível do anti-overbooking: quem perde a corrida precisa de
    // um caminho de volta, não só de uma mensagem.
    final repo = FakeReservasRepository([])
      ..erroAoCriar = const ApiException(
        "Esse horário acabou de ser reservado.",
        status: 409,
      );
    await abrir(tester, repo);

    await tester.tap(find.text("Pagar com Pix"));
    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Esse horário acabou de ser reservado."),
    );

    expect(find.text("Ver horários"), findsOneWidget);
    // E o cliente continua no checkout, não é expulso da tela.
    expect(find.byType(CheckoutPage), findsOneWidget);
  });

  testWidgets("erro comum mostra a mensagem sem a ação de voltar", (
    tester,
  ) async {
    final repo = FakeReservasRepository([])
      ..erroAoCriar = const ApiException("Sem conexão com o servidor.");
    await abrir(tester, repo);

    await tester.tap(find.text("Pagar com Pix"));
    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Sem conexão com o servidor."),
    );

    expect(find.text("Ver horários"), findsNothing);
  });
}
