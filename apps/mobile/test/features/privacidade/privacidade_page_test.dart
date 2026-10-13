// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/privacidade/domain/privacidade_repository.dart";
import "package:rally_mobile/features/privacidade/presentation/privacidade_page.dart";
import "package:rally_mobile/features/privacidade/presentation/privacidade_providers.dart";

import "../../fakes/fake_auth_repository.dart";
import "../../fakes/fake_privacidade_repository.dart";

/// Direitos do titular dos dados no aplicativo (RNF-07, LGPD).
void main() {
  late FakePrivacidadeRepository privacidade;
  late FakeAuthRepository auth;

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() {
    privacidade = FakePrivacidadeRepository();
    auth = FakeAuthRepository();
  });

  Future<void> abrir(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: "/privacidade",
      routes: [
        GoRoute(
          path: "/perfil",
          builder: (_, __) => const Scaffold(body: Text("perfil")),
        ),
        GoRoute(
          path: "/privacidade",
          builder: (_, __) => const PrivacidadePage(),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          privacidadeRepositoryProvider.overrideWithValue(privacidade),
          authRepositoryProvider.overrideWithValue(auth),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  final baixar = find.widgetWithText(FilledButton, "Baixar meus dados");
  final excluir = find.widgetWithText(OutlinedButton, "Excluir minha conta");

  testWidgets("diz o que cada direito faz antes do botão", (tester) async {
    await abrir(tester);

    expect(find.textContaining("outro sistema consegue ler"), findsOneWidget);
    // Quem vai excluir merece saber, antes de tocar, que o histórico de
    // pagamento continua existindo por obrigação fiscal.
    expect(find.textContaining("obrigação fiscal"), findsWidgets);
  });

  testWidgets("a exportação diz o que veio e o que não veio", (tester) async {
    await abrir(tester);

    await tester.tap(baixar);
    await tester.pumpAndSettle();

    expect(privacidade.chamadasDeExportacao, 1);
    expect(find.textContaining("3 reserva(s)"), findsOneWidget);
    expect(find.textContaining("2 aviso(s)"), findsOneWidget);
    // A senha não vai no arquivo, e a tela diz isso sem precisar perguntar.
    expect(find.textContaining("Sua senha não vai no arquivo"), findsOneWidget);
  });

  testWidgets("não exclui sem confirmação", (tester) async {
    await abrir(tester);

    await tester.tap(excluir);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, "Cancelar"));
    await tester.pumpAndSettle();

    expect(privacidade.chamadasDeExclusao, 0);
    expect(auth.saiu, isFalse);
  });

  testWidgets("a confirmação avisa que não dá para desfazer", (tester) async {
    await abrir(tester);

    await tester.tap(excluir);
    await tester.pumpAndSettle();

    expect(find.textContaining("não tem como ser desfeito"), findsOneWidget);
  });

  testWidgets("confirmado, exclui e sai da sessão", (tester) async {
    // A sessão aponta para uma conta que não existe mais; qualquer tela que
    // ela abrisse falharia sem explicar por quê.
    await abrir(tester);

    await tester.tap(excluir);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, "Excluir"));
    await tester.pumpAndSettle();

    expect(privacidade.chamadasDeExclusao, 1);
    expect(auth.saiu, isTrue);
  });

  testWidgets(
    "a recusa da API aparece inteira, e a sessão continua",
    (tester) async {
      // A mensagem de "última administradora" diz o que fazer; trocá-la por
      // texto genérico apagaria a única parte útil.
      privacidade.erroDeExclusao = const PrivacidadeException(
        "Você é o único administrador de Arena Beira-Rio. Promova outra "
        "pessoa a administrador antes de excluir a conta.",
      );
      await abrir(tester);

      await tester.tap(excluir);
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, "Excluir"));
      await tester.pumpAndSettle();

      expect(find.textContaining("Promova outra pessoa"), findsOneWidget);
      expect(auth.saiu, isFalse);
    },
  );

  testWidgets(
    "trava os dois botões enquanto uma chamada não termina",
    (tester) async {
      privacidade.exportacaoPendente = true;
      await abrir(tester);

      await tester.tap(baixar);
      await tester.pump();

      expect(find.text("Preparando…"), findsOneWidget);
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNull,
      );
    },
  );
}
