// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:rally_mobile/features/auth/domain/auth_repository.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/auth/presentation/cadastro_page.dart";

import "../../fakes/fake_auth_repository.dart";

/// Tela de criação de conta (RF-01).
void main() {
  late FakeAuthRepository repositorio;

  setUpAll(() {
    // Sem buscar fonte na rede durante o teste — o fallback basta.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  setUp(() {
    repositorio = FakeAuthRepository();
  });

  /// Sobe a tela sozinha, com um router mínimo para o "voltar" funcionar.
  Future<void> abrirCadastro(WidgetTester tester) async {
    // Janela alta o bastante para o formulário inteiro caber sem rolagem.
    tester.view.physicalSize = const Size(1200, 3000);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: "/cadastro",
      routes: [
        GoRoute(
          path: "/login",
          builder: (_, __) => const Scaffold(body: Text("tela de login")),
        ),
        GoRoute(path: "/cadastro", builder: (_, __) => const CadastroPage()),
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

  Finder campo(String rotulo) => find.widgetWithText(TextFormField, rotulo);
  final botaoCriar = find.widgetWithText(FilledButton, "Criar conta");

  Future<void> preencher(
    WidgetTester tester, {
    String nome = "Lucas Ackermann",
    String email = "lucas@rally.com.br",
    String senha = "senha123",
    String? confirmacao,
  }) async {
    await tester.enterText(campo("Nome"), nome);
    await tester.enterText(campo("E-mail"), email);
    await tester.enterText(campo("Senha"), senha);
    await tester.enterText(campo("Confirmar senha"), confirmacao ?? senha);
  }

  testWidgets("não chama a API com o formulário vazio", (tester) async {
    await abrirCadastro(tester);

    await tester.tap(botaoCriar);
    await tester.pumpAndSettle();

    expect(find.text("Informe seu nome"), findsOneWidget);
    expect(find.text("Informe um e-mail válido"), findsOneWidget);
    expect(repositorio.chamadasDeCadastro, 0);
  });

  testWidgets("acusa senha e confirmação diferentes", (tester) async {
    await abrirCadastro(tester);
    await preencher(tester, senha: "senha123", confirmacao: "senha124");

    await tester.tap(botaoCriar);
    await tester.pumpAndSettle();

    expect(find.text("As senhas não conferem"), findsOneWidget);
    expect(repositorio.chamadasDeCadastro, 0);
  });

  testWidgets("recusa senha com menos de 6 caracteres", (tester) async {
    await abrirCadastro(tester);
    await preencher(tester, senha: "12345");

    await tester.tap(botaoCriar);
    await tester.pumpAndSettle();

    expect(find.text("Mínimo de 6 caracteres"), findsWidgets);
    expect(repositorio.chamadasDeCadastro, 0);
  });

  testWidgets("envia nome e e-mail sem espaços sobrando", (tester) async {
    await abrirCadastro(tester);
    await preencher(
      tester,
      nome: "  Lucas Ackermann  ",
      email: "  lucas@rally.com.br  ",
      senha: "senha123",
    );

    await tester.tap(botaoCriar);
    await tester.pumpAndSettle();

    expect(repositorio.chamadasDeCadastro, 1);
    expect(repositorio.nomeRecebido, "Lucas Ackermann");
    expect(repositorio.emailRecebido, "lucas@rally.com.br");
    // A senha vai como digitada: espaço é caractere válido.
    expect(repositorio.senhaRecebida, "senha123");
  });

  testWidgets("mostra a mensagem da API quando o e-mail já existe", (
    tester,
  ) async {
    repositorio.erroDeCadastro = const AuthException("E-mail já cadastrado.");
    await abrirCadastro(tester);
    await preencher(tester);

    await tester.tap(botaoCriar);
    await tester.pumpAndSettle();

    expect(
        find.widgetWithText(SnackBar, "E-mail já cadastrado."), findsOneWidget);
    // A tela continua no ar para o cliente corrigir o e-mail.
    expect(find.byType(CadastroPage), findsOneWidget);
  });

  testWidgets("bloqueia o botão e mostra progresso durante o envio", (
    tester,
  ) async {
    repositorio.cadastroPendente = true;
    await abrirCadastro(tester);
    await preencher(tester);

    await tester.tap(botaoCriar);
    // `pumpAndSettle` não serve: o indicador de progresso gira sem parar.
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
  });
}
