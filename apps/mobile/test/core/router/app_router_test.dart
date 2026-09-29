// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:rally_mobile/core/app.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/auth/presentation/cadastro_page.dart";
import "package:rally_mobile/features/auth/presentation/login_page.dart";
import "package:rally_mobile/features/splash/presentation/splash_page.dart";

import "../../fakes/fake_auth_repository.dart";

/// Guard de autenticação do router.
///
/// Nenhum teste aqui usa `pumpAndSettle`: o splash e o botão em envio têm
/// indicadores de progresso que giram para sempre e nunca "assentam". E um
/// número fixo de `pump` também não serve — `tap` e `enterText` bombeiam com
/// duração **zero**, e uma rota que sai ainda leva alguns quadros além da
/// animação para ser descartada. Por isso tudo aqui espera por uma condição.
void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  /// Bombeia quadros até o alvo aparecer.
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

  /// Bombeia quadros até o alvo sumir.
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

  /// O cadastro é **empilhado** sobre o login, que continua montado embaixo.
  /// Sem restringir a busca à tela de cima, rótulos repetidos entre as duas
  /// (E-mail, Senha) casariam duas vezes.
  Finder noCadastro(Finder alvo) =>
      find.descendant(of: find.byType(CadastroPage), matching: alvo);

  Future<void> abrirApp(WidgetTester tester, FakeAuthRepository repo) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repo)],
        child: const RallyApp(),
      ),
    );
  }

  /// Leva o app do arranque até a tela de cadastro.
  Future<void> irAteOCadastro(WidgetTester tester) async {
    await bombearAteSurgir(tester, find.byType(LoginPage));
    await bombearAteSumir(tester, find.byType(SplashPage));

    await tester.tap(find.widgetWithText(TextButton, "Criar conta"));
    await bombearAteSurgir(tester, find.byType(CadastroPage));
  }

  testWidgets("sem sessão guardada, o arranque termina no login", (
    tester,
  ) async {
    await abrirApp(tester, FakeAuthRepository());

    // O primeiro quadro é o splash, enquanto o token é consultado.
    expect(find.byType(SplashPage), findsOneWidget);

    await bombearAteSurgir(tester, find.byType(LoginPage));
    await bombearAteSumir(tester, find.byType(SplashPage));

    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets("o login leva ao cadastro e o cadastro volta para o login", (
    tester,
  ) async {
    await abrirApp(tester, FakeAuthRepository());
    await irAteOCadastro(tester);

    await tester.tap(find.widgetWithText(TextButton, "Já tenho conta"));
    await bombearAteSumir(tester, find.byType(CadastroPage));

    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets("o cadastro em curso não é jogado de volta para o splash", (
    tester,
  ) async {
    // Regressão: o guard mandava para `/splash` a cada `AsyncLoading`, o que
    // desmontava a tela no meio do envio — o erro da API nunca aparecia.
    final repo = FakeAuthRepository()..cadastroPendente = true;
    await abrirApp(tester, repo);
    await irAteOCadastro(tester);

    await tester.enterText(
      noCadastro(find.widgetWithText(TextFormField, "Nome")),
      "Lucas Ackermann",
    );
    await tester.enterText(
      noCadastro(find.widgetWithText(TextFormField, "E-mail")),
      "lucas@rally.com.br",
    );
    await tester.enterText(
      noCadastro(find.widgetWithText(TextFormField, "Senha")),
      "senha123",
    );
    await tester.enterText(
      noCadastro(find.widgetWithText(TextFormField, "Confirmar senha")),
      "senha123",
    );

    await tester.tap(
      noCadastro(find.widgetWithText(FilledButton, "Criar conta")),
    );
    // Tempo de sobra para um redirect indevido ao splash se materializar.
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.chamadasDeCadastro, 1);
    expect(find.byType(CadastroPage), findsOneWidget);
    expect(find.byType(SplashPage), findsNothing);
  });
}
