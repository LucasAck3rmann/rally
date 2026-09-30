// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/widgets/brand_bar.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";
import "package:rally_mobile/features/gestao/presentation/quadras_gestao_page.dart";

import "../../fakes/fake_gestao_repository.dart";

/// Gestão de quadras no celular (RF-20): listar, pausar e reativar.
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

  Future<FakeGestaoRepository> abrir(
    WidgetTester tester, {
    FakeGestaoRepository? repositorio,
    String rotaInicial = "/gestao",
  }) async {
    // 360 x 1200 lógicos: o celular Android mais estreito que o app atende.
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repo = repositorio ?? FakeGestaoRepository();

    final router = GoRouter(
      initialLocation: rotaInicial,
      routes: [
        GoRoute(
          path: "/gestao",
          builder: (_, __) => const GestaoPage(),
          routes: [
            GoRoute(
              path: ":estabelecimentoId/quadras",
              builder: (_, state) => QuadrasGestaoPage(
                estabelecimentoId: state.pathParameters["estabelecimentoId"]!,
              ),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [gestaoRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
    return repo;
  }

  testWidgets("com um vínculo só, entra direto nas quadras", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        quadras: [quadraFalsa(nome: "Quadra do Fundo")],
      ),
    );

    await bombearAteSurgir(tester, find.text("Quadra do Fundo"));
    // Não passou pelo seletor: o nome da arena virou o título da tela.
    expect(find.text("Arena Beach Sapiranga"), findsOneWidget);
    expect(find.text("Seus estabelecimentos"), findsNothing);
  });

  testWidgets("com mais de um vínculo, escolhe qual arena abrir",
      (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        estabelecimentos: [
          estabelecimentoFalso(id: "e1", nome: "Arena Beach Sapiranga"),
          estabelecimentoFalso(id: "e2", nome: "Arena Centro", quadras: 1),
        ],
        quadras: [quadraFalsa(nome: "Quadra Coberta")],
      ),
    );

    await bombearAteSurgir(tester, find.text("Seus estabelecimentos"));
    expect(find.text("Arena Centro"), findsOneWidget);
    expect(find.text("1 quadra · Administrador"), findsOneWidget);

    await tester.tap(find.text("Arena Centro"));
    await bombearAteSurgir(tester, find.text("Quadra Coberta"));
  });

  testWidgets("o preço e as faixas aparecem no card", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        quadras: [quadraFalsa(precoHora: 140, faixas: 2)],
      ),
    );

    await bombearAteSurgir(tester, find.text("R\$ 140 / hora"));
    expect(find.text("2 FAIXAS DE PREÇO"), findsOneWidget);
  });

  testWidgets("pausar tira a quadra da vitrine e o selo muda", (tester) async {
    final repo = await abrir(
      tester,
      repositorio: FakeGestaoRepository(quadras: [quadraFalsa()]),
    );

    await bombearAteSurgir(tester, find.text("Pausar"));
    expect(find.text("NA VITRINE"), findsOneWidget);

    await tester.tap(find.text("Pausar"));
    await bombearAteSurgir(tester, find.text("PAUSADA"));

    expect(repo.alteracoes, [("q1", false)]);
    expect(find.text("Reativar"), findsOneWidget);
    // O resumo do cabeçalho acompanha.
    expect(find.text("1 quadra · 1 pausada"), findsOneWidget);
  });

  testWidgets("reativar devolve a quadra à vitrine", (tester) async {
    final repo = await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        quadras: [quadraFalsa(ativo: false)],
      ),
    );

    await bombearAteSurgir(tester, find.text("Reativar"));
    await tester.tap(find.text("Reativar"));
    await bombearAteSurgir(tester, find.text("NA VITRINE"));

    expect(repo.alteracoes, [("q1", true)]);
  });

  testWidgets("quem não é administrador não vê o botão de pausar",
      (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        estabelecimentos: [estabelecimentoFalso(papel: PapelGestao.atendente)],
        quadras: [quadraFalsa()],
      ),
    );

    await bombearAteSurgir(tester, find.text("Quadra 1"));
    // O selo continua: o atendente enxerga o estado, só não o altera.
    expect(find.text("NA VITRINE"), findsOneWidget);
    expect(find.text("Pausar"), findsNothing);
  });

  testWidgets("erro ao pausar avisa e mantém o estado", (tester) async {
    final repo = FakeGestaoRepository(quadras: [quadraFalsa()])
      ..erroAoSalvar = Exception("Sem conexão com o servidor");
    await abrir(tester, repositorio: repo);

    await bombearAteSurgir(tester, find.text("Pausar"));
    await tester.tap(find.text("Pausar"));

    await bombearAteSurgir(
      tester,
      find.textContaining("Sem conexão com o servidor"),
    );
    // A quadra continua na vitrine e o botão volta a responder.
    expect(find.text("NA VITRINE"), findsOneWidget);
    expect(find.text("Pausar"), findsOneWidget);
  });

  testWidgets("sem quadras, explica o que fazer", (tester) async {
    await abrir(tester, repositorio: FakeGestaoRepository(quadras: []));

    await bombearAteSurgir(tester, find.text("Nenhuma quadra cadastrada"));
  });

  testWidgets("voltar sai da área de gestão", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        estabelecimentos: [
          estabelecimentoFalso(id: "e1"),
          estabelecimentoFalso(id: "e2", nome: "Arena Centro"),
        ],
        quadras: [quadraFalsa(nome: "Quadra Coberta")],
      ),
    );

    await bombearAteSurgir(tester, find.text("Arena Centro"));
    await tester.tap(find.text("Arena Centro"));
    await bombearAteSurgir(tester, find.text("Quadra Coberta"));

    // O seletor continua montado embaixo; o botão de cima é o da pilha.
    await tester.tap(find.byType(BotaoVoltarCircular).last);
    await bombearAteSumir(tester, find.text("Quadra Coberta"));
    expect(find.text("Seus estabelecimentos"), findsOneWidget);
  });
}
