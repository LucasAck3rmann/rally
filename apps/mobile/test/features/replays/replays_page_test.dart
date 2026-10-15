// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/core/widgets/rally_chip.dart";
import "package:rally_mobile/features/replays/domain/replay.dart";
import "package:rally_mobile/features/replays/presentation/replays_page.dart";
import "package:rally_mobile/features/replays/presentation/replays_providers.dart";

import "../../fakes/fake_replays_repository.dart";

/// Replays — o diferencial do produto.
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

  Future<void> abrir(WidgetTester tester, FakeReplaysRepository repo) async {
    tester.view.physicalSize = const Size(1200, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [replaysRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: Scaffold(body: ReplaysPage())),
      ),
    );
    await tester.pump();
  }

  testWidgets("o primeiro clipe vira destaque e o resto vira lista", (
    tester,
  ) async {
    await abrir(
      tester,
      FakeReplaysRepository([
        replayFalso(id: "rp1", titulo: "Cortada da vitória"),
        replayFalso(id: "rp2", titulo: "Defesa no reflexo", diasAtras: 2),
      ]),
    );

    await bombearAteSurgir(tester, find.text("Destaque da semana"));
    expect(find.text("Cortada da vitória"), findsOneWidget);
    expect(find.text("Seus replays"), findsOneWidget);
    expect(find.text("Defesa no reflexo"), findsOneWidget);
  });

  testWidgets("com um clipe só não há seção de lista", (tester) async {
    await abrir(
      tester,
      FakeReplaysRepository([replayFalso(titulo: "Único ponto")]),
    );

    await bombearAteSurgir(tester, find.text("Destaque da semana"));
    expect(find.text("Seus replays"), findsNothing);
  });

  testWidgets("mostra o vazio de quem ainda não tem clipe", (tester) async {
    await abrir(tester, FakeReplaysRepository(const []));

    await bombearAteSurgir(tester, find.text("Nenhum replay ainda"));
  });

  testWidgets("o período escolhido chega à consulta", (tester) async {
    final repo = FakeReplaysRepository([replayFalso()]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Destaque da semana"));

    // A tela abre em "Esta semana"; trocar precisa refazer a busca.
    expect(repo.periodos.first, PeriodoReplay.semana);

    await tester.tap(find.widgetWithText(RallyChip, "Este mês"));
    await tester.pump(const Duration(milliseconds: 200));

    expect(repo.periodos.last, PeriodoReplay.mes);
  });

  testWidgets("mostra o erro da API", (tester) async {
    final repo = FakeReplaysRepository(const [])
      ..erro = const ApiException("Sem conexão com o servidor.");
    await abrir(tester, repo);

    await bombearAteSurgir(tester, find.text("Sem conexão com o servidor."));
  });
}
