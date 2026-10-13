// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:rally_mobile/features/auth/domain/auth_repository.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/auth/presentation/recuperar_senha_page.dart";

import "../../fakes/fake_auth_repository.dart";

/// Pedido de link de redefinição de senha (RF-03).
void main() {
  late FakeAuthRepository repositorio;

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() {
    repositorio = FakeAuthRepository();
  });

  Future<void> abrir(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: "/recuperar-senha",
      routes: [
        GoRoute(
          path: "/login",
          builder: (_, __) => const Scaffold(body: Text("tela de login")),
        ),
        GoRoute(
          path: "/recuperar-senha",
          builder: (_, __) => const RecuperarSenhaPage(),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repositorio)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  final campoEmail = find.widgetWithText(TextFormField, "E-mail");
  final botaoEnviar = find.widgetWithText(FilledButton, "Enviar link");

  testWidgets("não chama a API com o campo vazio", (tester) async {
    await abrir(tester);

    await tester.tap(botaoEnviar);
    await tester.pumpAndSettle();

    expect(find.text("Informe o e-mail da conta."), findsOneWidget);
    expect(repositorio.chamadasDeRecuperacao, 0);
  });

  testWidgets("recusa endereço sem arroba antes de sair do aparelho",
      (tester) async {
    await abrir(tester);

    await tester.enterText(campoEmail, "lucas.rally.com.br");
    await tester.tap(botaoEnviar);
    await tester.pumpAndSettle();

    expect(find.text("Informe um e-mail válido."), findsOneWidget);
    expect(repositorio.chamadasDeRecuperacao, 0);
  });

  testWidgets("envia o e-mail sem espaço em volta", (tester) async {
    await abrir(tester);

    await tester.enterText(campoEmail, "  lucas@rally.com.br  ");
    await tester.tap(botaoEnviar);
    await tester.pumpAndSettle();

    expect(repositorio.chamadasDeRecuperacao, 1);
    expect(repositorio.emailDaRecuperacao, "lucas@rally.com.br");
  });

  testWidgets("o aviso não confirma que a conta existe", (tester) async {
    // É a asserção que mais importa nesta tela. A API responde igual para
    // endereço cadastrado e não cadastrado, e a interface não pode desfazer
    // isso — a diferença entre as duas telas seria uma lista de clientes.
    await abrir(tester);

    await tester.enterText(campoEmail, "lucas@rally.com.br");
    await tester.tap(botaoEnviar);
    await tester.pumpAndSettle();

    expect(
        find.textContaining("Se houver conta com esse e-mail"), findsOneWidget);
    expect(find.textContaining("enviamos para você"), findsNothing);
  });

  testWidgets("avisa que o link abre no navegador", (tester) async {
    // A redefinição em si acontece na web; dizer isso evita a pessoa ficar
    // esperando o aplicativo abrir sozinho ao tocar no link.
    await abrir(tester);

    expect(find.textContaining("abre no navegador"), findsOneWidget);
  });

  testWidgets("diz que pedir outro link invalida o anterior", (tester) async {
    await abrir(tester);

    await tester.enterText(campoEmail, "lucas@rally.com.br");
    await tester.tap(botaoEnviar);
    await tester.pumpAndSettle();

    expect(find.textContaining("invalida o link anterior"), findsOneWidget);
  });

  testWidgets("trava o botão enquanto a chamada não termina", (tester) async {
    // Sem isso, dois toques seguidos emitem dois tokens e o primeiro link
    // que chegar na caixa de entrada já estará inválido.
    repositorio.recuperacaoPendente = true;
    await abrir(tester);

    await tester.enterText(campoEmail, "lucas@rally.com.br");
    await tester.tap(botaoEnviar);
    await tester.pump();

    expect(find.text("Enviando…"), findsOneWidget);
    // Pelo tipo e não pelo rótulo: enquanto envia, o texto do botão é outro.
    await tester.tap(find.byType(FilledButton));
    await tester.pump();
    expect(repositorio.chamadasDeRecuperacao, 1);
  });

  testWidgets("mostra a falha sem levar para o aviso de enviado",
      (tester) async {
    repositorio.erroDeRecuperacao =
        const AuthException("Nao foi possivel enviar agora. Tente novamente.");
    await abrir(tester);

    await tester.enterText(campoEmail, "lucas@rally.com.br");
    await tester.tap(botaoEnviar);
    await tester.pumpAndSettle();

    expect(
        find.textContaining("Nao foi possivel enviar agora"), findsOneWidget);
    expect(
        find.textContaining("Se houver conta com esse e-mail"), findsNothing);
  });
}
