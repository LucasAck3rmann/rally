// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/core/widgets/rally_chip.dart";
import "package:rally_mobile/features/home/presentation/home_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadras_providers.dart";

import "../../fakes/fake_quadras_repository.dart";

/// Vitrine da Home: busca, chips de modalidade e estados da lista.
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
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          quadrasRepositoryProvider.overrideWithValue(repo),
          // A promoção tem repositório concreto (sem interface); aqui basta
          // dizer que não há destaque para a Home não tentar a rede.
          promocaoDestaqueProvider.overrideWith((ref) async => null),
        ],
        child: const MaterialApp(home: Scaffold(body: HomePage())),
      ),
    );
    await tester.pump();
  }

  testWidgets("mostra as quadras que a API devolveu", (tester) async {
    await abrir(
      tester,
      FakeQuadrasRepository(
        quadras: [
          quadraFalsa(id: "q1"),
          quadraFalsa(
            id: "q2",
            estabelecimento: estabelecimentoFalso(
              id: "e2",
              nome: "Vila do Vôlei",
              bairro: "São Luiz",
            ),
          ),
        ],
      ),
    );

    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));
    expect(find.text("Vila do Vôlei"), findsOneWidget);
    // A linha de apoio junta bairro e cidade.
    expect(find.text("Centro · Sapiranga"), findsOneWidget);
  });

  testWidgets("mostra o vazio quando não há quadra para o filtro", (
    tester,
  ) async {
    await abrir(tester, FakeQuadrasRepository(quadras: const []));

    await bombearAteSurgir(tester, find.text("Nenhuma quadra por aqui"));
  });

  testWidgets("mostra o erro da API com opção de tentar de novo", (
    tester,
  ) async {
    final repo = FakeQuadrasRepository()
      ..erro = const ApiException("Sem conexão com o servidor.");
    await abrir(tester, repo);

    await bombearAteSurgir(tester, find.text("Sem conexão com o servidor."));
  });

  testWidgets("o chip de modalidade entra na consulta", (tester) async {
    final repo = FakeQuadrasRepository(quadras: [quadraFalsa()]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));

    await tester.tap(find.widgetWithText(RallyChip, "Futevôlei"));
    await bombearAteSurgir(
      tester,
      find.byType(HomePage),
    ); // deixa o provider refazer
    await tester.pump(const Duration(milliseconds: 100));

    expect(repo.consultas.last.modalidade, "Futevôlei");
  });

  testWidgets("tocar de novo no chip ativo limpa o filtro", (tester) async {
    final repo = FakeQuadrasRepository(quadras: [quadraFalsa()]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));

    final chip = find.widgetWithText(RallyChip, "Futevôlei");
    await tester.tap(chip);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(chip);
    await tester.pump(const Duration(milliseconds: 100));

    expect(repo.consultas.last.modalidade, isNull);
  });

  testWidgets("a busca espera o cliente parar de digitar", (tester) async {
    final repo = FakeQuadrasRepository(quadras: [quadraFalsa()]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));

    final antes = repo.consultas.length;
    await tester.enterText(find.byType(TextField), "beach");

    // Meio caminho do debounce: nada foi para a rede ainda.
    await tester.pump(const Duration(milliseconds: 150));
    expect(repo.consultas.length, antes);

    // Passado o silêncio de 350ms, a consulta sai uma vez só.
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump(const Duration(milliseconds: 100));

    expect(repo.consultas.length, antes + 1);
    expect(repo.consultas.last.busca, "beach");
  });

  testWidgets("a busca vai sem espaço sobrando", (tester) async {
    final repo = FakeQuadrasRepository(quadras: [quadraFalsa()]);
    await abrir(tester, repo);
    await bombearAteSurgir(tester, find.text("Arena Beach Sapiranga"));

    await tester.enterText(find.byType(TextField), "  vila  ");
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 100));

    expect(repo.consultas.last.busca, "vila");
  });
}
