// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/reservas/presentation/minhas_reservas_page.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";

import "../../fakes/fake_reservas_repository.dart";

/// Cancelamento de reserva na aba "Reservas" (RF-09 / RN-02).
void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    // `Formato.diaCurto` usa DateFormat em pt-BR; sem isto ele lança.
    await initializeDateFormatting("pt_BR");
  });

  /// Bombeia quadros até o alvo aparecer — a lista chega por Future e a tela
  /// mostra um indicador de progresso enquanto isso, que nunca "assenta".
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

  Future<void> abrir(WidgetTester tester, FakeReservasRepository repo) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [reservasRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(
          home: Scaffold(body: MinhasReservasPage()),
        ),
      ),
    );
    await bombearAteSurgir(tester, find.text("Arena Beira-Rio"));
  }

  // O botão do card é um TextButton; o de confirmar, no diálogo, é um
  // FilledButton — é o que separa os dois "Cancelar reserva" da tela.
  final botaoDoCard = find.widgetWithText(TextButton, "Cancelar reserva");
  final confirmarNoDialogo =
      find.widgetWithText(FilledButton, "Cancelar reserva");

  testWidgets("só oferece cancelar nas reservas canceláveis", (tester) async {
    await abrir(
      tester,
      FakeReservasRepository([
        reservaFalsa(id: "r1"),
        reservaFalsa(
          id: "r2",
          cancelavel: false,
          estabelecimentoNome: "Arena Sul",
        ),
      ]),
    );

    expect(find.text("Arena Sul"), findsOneWidget);
    expect(botaoDoCard, findsOneWidget);
  });

  testWidgets("avisa no próprio botão quando está fora do prazo", (
    tester,
  ) async {
    await abrir(
      tester,
      FakeReservasRepository([reservaFalsa(cancelamentoGratuito: false)]),
    );

    expect(find.text("Cancelar (fora do prazo)"), findsOneWidget);
    expect(botaoDoCard, findsNothing);
  });

  testWidgets("pede confirmação e respeita o 'Manter'", (tester) async {
    final repo = FakeReservasRepository([reservaFalsa()]);
    await abrir(tester, repo);

    await tester.tap(botaoDoCard);
    await bombearAteSurgir(tester, find.text("Cancelar reserva?"));

    // O diálogo precisa dizer a política, não só perguntar.
    expect(find.textContaining("dentro do prazo de 12 h"), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, "Manter"));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.cancelados, isEmpty);
  });

  testWidgets("cancela ao confirmar e avisa que foi dentro do prazo", (
    tester,
  ) async {
    final repo = FakeReservasRepository([reservaFalsa()]);
    await abrir(tester, repo);

    await tester.tap(botaoDoCard);
    await bombearAteSurgir(tester, confirmarNoDialogo);
    await tester.tap(confirmarNoDialogo);

    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Reserva cancelada dentro do prazo."),
    );
    expect(repo.cancelados, ["r1"]);
  });

  testWidgets("diz que não há devolução quando cancela fora do prazo", (
    tester,
  ) async {
    final repo = FakeReservasRepository([
      reservaFalsa(cancelamentoGratuito: false),
    ])
      ..dentroDoPrazo = false;
    await abrir(tester, repo);

    await tester
        .tap(find.widgetWithText(TextButton, "Cancelar (fora do prazo)"));
    await bombearAteSurgir(tester, confirmarNoDialogo);
    await tester.tap(confirmarNoDialogo);

    await bombearAteSurgir(
      tester,
      find.widgetWithText(
        SnackBar,
        "Reserva cancelada fora do prazo — sem devolução do valor.",
      ),
    );
  });

  testWidgets("mostra o erro da API sem tirar o cliente da tela", (
    tester,
  ) async {
    final repo = FakeReservasRepository([reservaFalsa()])
      ..erroAoCancelar = const ApiException("Esta reserva já foi cancelada.");
    await abrir(tester, repo);

    await tester.tap(botaoDoCard);
    await bombearAteSurgir(tester, confirmarNoDialogo);
    await tester.tap(confirmarNoDialogo);

    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Esta reserva já foi cancelada."),
    );
    expect(find.byType(MinhasReservasPage), findsOneWidget);
    // Com o erro, o botão volta a ficar disponível para nova tentativa.
    expect(botaoDoCard, findsOneWidget);
  });
}
