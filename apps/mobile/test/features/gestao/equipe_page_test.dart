// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
import "package:rally_mobile/features/gestao/presentation/equipe_page.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";

import "../../fakes/fake_gestao_repository.dart";

/// Equipe do estabelecimento (RF-23).
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

  Future<FakeGestaoRepository> abrir(
    WidgetTester tester, {
    FakeGestaoRepository? repositorio,
  }) async {
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repo = repositorio ?? FakeGestaoRepository();

    final router = GoRouter(
      initialLocation: "/equipe",
      routes: [
        GoRoute(
          path: "/equipe",
          builder: (_, __) => const EquipePage(estabelecimentoId: "e1"),
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

  /// Abre um menu ou folha e espera parar de animar — tocar durante a
  /// animação erra o alvo e o teste culpa o código errado.
  Future<void> abrirEEsperar(
    WidgetTester tester,
    Finder gatilho,
    Finder alvo,
  ) async {
    await tester.tap(gatilho);
    await bombearAteSurgir(tester, alvo);
    var anterior = -1.0;
    for (var i = 0; i < 20; i++) {
      final topo = tester.getTopLeft(alvo).dy;
      if (topo == anterior) break;
      anterior = topo;
      await tester.pump(const Duration(milliseconds: 50));
    }
    // O menu do `PopupMenuButton` anima por opacidade, não por posição:
    // a posição estabiliza antes de a rota aceitar toque, e um toque ali
    // não acontece. Este respiro cobre o resto da animação.
    await tester.pump(const Duration(milliseconds: 400));
  }

  testWidgets("mostra nome, e-mail, papel e desde quando", (tester) async {
    await abrir(tester);

    await bombearAteSurgir(tester, find.text("Augusto Boff"));
    expect(find.text("augusto@rally.com.br"), findsOneWidget);
    expect(find.textContaining("ATENDENTE · DESDE"), findsOneWidget);
    // Iniciais do primeiro e do último nome, como no Perfil.
    expect(find.text("AB"), findsOneWidget);
  });

  testWidgets("o administrador tem por onde adicionar", (tester) async {
    await abrir(tester);
    await bombearAteSurgir(tester, find.text("Adicionar pessoa"));
  });

  testWidgets("quem não é administrador não vê como mexer", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        estabelecimentos: [estabelecimentoFalso(papel: PapelGestao.financeiro)],
      ),
    );

    // Ver a equipe é de toda a equipe — saber a quem recorrer não é
    // privilégio. Mexer é que é do admin.
    await bombearAteSurgir(tester, find.text("Augusto Boff"));
    expect(find.text("Adicionar pessoa"), findsNothing);
    expect(find.byTooltip("Opções de Augusto Boff"), findsNothing);
  });

  testWidgets("adicionar manda e-mail e papel para a API", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Adicionar pessoa"));

    await abrirEEsperar(
      tester,
      find.text("Adicionar pessoa"),
      find.text("Adicionar à equipe"),
    );
    await tester.enterText(find.byType(TextField), "novo@rally.com.br");
    await tester.tap(find.text("Financeiro"));
    await tester.pump();
    await tester.tap(find.text("Adicionar"));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.convites, [("novo@rally.com.br", PapelGestao.financeiro)]);
  });

  testWidgets("e-mail inválido não vai para a rede", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Adicionar pessoa"));

    await abrirEEsperar(
      tester,
      find.text("Adicionar pessoa"),
      find.text("Adicionar à equipe"),
    );
    await tester.enterText(find.byType(TextField), "augusto");
    await tester.tap(find.text("Adicionar"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.convites, isEmpty);
    expect(find.text("Informe um e-mail válido."), findsOneWidget);
  });

  testWidgets("trocar o papel manda a troca", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Augusto Boff"));

    await abrirEEsperar(
      tester,
      find.byTooltip("Opções de Augusto Boff"),
      find.text("Administrador"),
    );
    await tester.tap(find.text("Administrador"));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.trocas, [("u2", PapelGestao.admin)]);
  });

  testWidgets("o último administrador não pode ser rebaixado nem tirado",
      (tester) async {
    // A API recusa; a tela desabilita antes do toque, porque oferecer o que
    // vai dar erro é pior que não oferecer. Depois de rebaixado não haveria
    // tela para desfazer — ela exige ser admin.
    final repo = FakeGestaoRepository()
      ..equipeDoLugar = [
        membroFalso(nome: "Lucas Ackermann", papel: PapelGestao.admin),
      ];
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, find.text("Lucas Ackermann"));

    await abrirEEsperar(
      tester,
      find.byTooltip("Opções de Lucas Ackermann"),
      find.text("Atendente"),
    );

    await tester.tap(find.text("Atendente"));
    await tester.pump(const Duration(milliseconds: 400));
    expect(repo.trocas, isEmpty);
  });

  testWidgets("com dois administradores, rebaixar é oferecido", (tester) async {
    final repo = FakeGestaoRepository()
      ..equipeDoLugar = [
        membroFalso(
          usuarioId: "u1",
          nome: "Lucas Ackermann",
          email: "lucas@rally.com.br",
          papel: PapelGestao.admin,
        ),
        membroFalso(papel: PapelGestao.admin),
      ];
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, find.text("Lucas Ackermann"));

    await abrirEEsperar(
      tester,
      find.byTooltip("Opções de Lucas Ackermann"),
      find.text("Atendente"),
    );
    await tester.tap(find.text("Atendente"));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.trocas, [("u1", PapelGestao.atendente)]);
  });

  testWidgets("tirar da equipe pergunta e diz o que acontece de verdade",
      (tester) async {
    final repo = FakeGestaoRepository()
      ..equipeDoLugar = [
        membroFalso(nome: "Lucas Ackermann", papel: PapelGestao.admin),
        membroFalso(),
      ];
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, find.text("Augusto Boff"));

    await abrirEEsperar(
      tester,
      find.byTooltip("Opções de Augusto Boff"),
      find.text("Tirar da equipe"),
    );
    await tester.tap(find.text("Tirar da equipe"));
    await bombearAteSurgir(
      tester,
      find.text("Tirar Augusto Boff da equipe?"),
    );

    // "Remover" sozinho soaria como apagar a pessoa; o vínculo vira cliente
    // e as reservas ficam, e a tela diz isso.
    expect(find.textContaining("continua cliente da arena"), findsOneWidget);

    await tester.tap(find.text("Manter"));
    await tester.pump(const Duration(milliseconds: 400));
    expect(repo.retirados, isEmpty);
  });

  testWidgets("erro da API aparece sem derrubar a tela", (tester) async {
    final repo = FakeGestaoRepository()
      ..erroAoSalvar = Exception("Ninguém com esse e-mail tem conta no Rally.");
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, find.text("Adicionar pessoa"));

    await abrirEEsperar(
      tester,
      find.text("Adicionar pessoa"),
      find.text("Adicionar à equipe"),
    );
    await tester.enterText(find.byType(TextField), "ninguem@rally.com.br");
    await tester.tap(find.text("Adicionar"));

    await bombearAteSurgir(
      tester,
      find.textContaining("tem conta no Rally"),
    );
    expect(find.text("Adicionar pessoa"), findsOneWidget);
  });
}
