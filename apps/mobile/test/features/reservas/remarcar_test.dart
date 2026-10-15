// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/quadras/presentation/agenda_widgets.dart";
import "package:rally_mobile/features/quadras/presentation/quadras_providers.dart";
import "package:rally_mobile/features/reservas/presentation/minhas_reservas_page.dart";
import "package:rally_mobile/features/reservas/presentation/remarcar_sheet.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";

import "../../fakes/fake_quadras_repository.dart";
import "../../fakes/fake_reservas_repository.dart";

/// Remarcação de reserva (RF-09 / RN-02).
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
    FakeReservasRepository reservas,
    FakeQuadrasRepository quadras,
  ) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          reservasRepositoryProvider.overrideWithValue(reservas),
          quadrasRepositoryProvider.overrideWithValue(quadras),
        ],
        child: const MaterialApp(
          home: Scaffold(body: MinhasReservasPage()),
        ),
      ),
    );
    await bombearAteSurgir(tester, find.text("Arena Beira-Rio"));
  }

  /// Bombeia quadros até o alvo sumir — uma rota que sai leva alguns quadros
  /// além da animação para ser descartada.
  Future<void> bombearAteSumir(
    WidgetTester tester,
    Finder alvo, {
    int maximo = 40,
  }) async {
    for (var i = 0; i < maximo; i++) {
      if (alvo.evaluate().isEmpty) return;
      await tester.pump(const Duration(milliseconds: 50));
    }
    fail("O alvo não sumiu depois de $maximo quadros: $alvo");
  }

  /// A folha sobe animada; sem deixar a animação terminar, os cartões existem
  /// na árvore mas ainda estão fora da tela e o toque erra o alvo.
  Future<void> assentar(WidgetTester tester) async {
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
  }

  final acaoRemarcar = find.widgetWithText(TextButton, "Remarcar");

  testWidgets("oferece remarcar só dentro do prazo", (tester) async {
    // Fora do prazo a remarcação some, pela mesma razão que a API recusa:
    // senão bastava empurrar a reserva para longe e cancelar de graça depois.
    await abrir(
      tester,
      FakeReservasRepository([
        reservaFalsa(id: "r1"),
        reservaFalsa(
          id: "r2",
          cancelamentoGratuito: false,
          estabelecimentoNome: "Arena Sul",
        ),
      ]),
      FakeQuadrasRepository(),
    );

    expect(find.text("Arena Sul"), findsOneWidget);
    expect(acaoRemarcar, findsOneWidget);
    // A de fora do prazo ainda pode cancelar, só não pode mover.
    expect(find.text("Cancelar (fora do prazo)"), findsOneWidget);
  });

  testWidgets("escolhe outro horário e move a reserva", (tester) async {
    final reservas = FakeReservasRepository([reservaFalsa()]);
    final quadras = FakeQuadrasRepository(
      slots: [slotFalso(19), slotFalso(20), slotFalso(21, disponivel: false)],
    );
    await abrir(tester, reservas, quadras);

    await tester.tap(acaoRemarcar);
    await bombearAteSurgir(tester, find.byType(FolhaRemarcar));
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "20:00"));
    await assentar(tester);

    // Antes de escolher, o botão convida a escolher.
    expect(find.text("Escolha um horário"), findsOneWidget);

    await tester.tap(find.widgetWithText(CartaoSlot, "20:00"));
    await bombearAteSurgir(tester, find.text("Mover para 20:00"));
    await tester.tap(find.text("Mover para 20:00"));

    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Reserva remarcada."),
    );

    final pedido = reservas.remarcacao;
    expect(pedido, isNotNull);
    expect(pedido!.$1, "r1");
    expect(pedido.$2.hour, 20);
    // A folha se fecha ao dar certo.
    await bombearAteSumir(tester, find.byType(FolhaRemarcar));
  });

  testWidgets("não deixa escolher horário ocupado", (tester) async {
    await abrir(
      tester,
      FakeReservasRepository([reservaFalsa()]),
      FakeQuadrasRepository(
        slots: [slotFalso(19), slotFalso(21, disponivel: false)],
      ),
    );

    await tester.tap(acaoRemarcar);
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "21:00"));
    await assentar(tester);

    await tester.tap(find.widgetWithText(CartaoSlot, "21:00"));
    await tester.pump(const Duration(milliseconds: 200));

    // Continua pedindo um horário: o toque no ocupado não seleciona nada.
    expect(find.text("Escolha um horário"), findsOneWidget);
  });

  testWidgets("mostra o erro da API sem fechar a folha", (tester) async {
    final reservas = FakeReservasRepository([reservaFalsa()])
      ..erroAoRemarcar = const ApiException("Horário indisponível.");
    await abrir(
      tester,
      reservas,
      FakeQuadrasRepository(slots: [slotFalso(20)]),
    );

    await tester.tap(acaoRemarcar);
    await bombearAteSurgir(tester, find.widgetWithText(CartaoSlot, "20:00"));
    await assentar(tester);
    await tester.tap(find.widgetWithText(CartaoSlot, "20:00"));
    await bombearAteSurgir(tester, find.text("Mover para 20:00"));
    await tester.tap(find.text("Mover para 20:00"));

    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Horário indisponível."),
    );
    // A folha fica aberta para o cliente tentar outro horário.
    expect(find.byType(FolhaRemarcar), findsOneWidget);
  });
}
