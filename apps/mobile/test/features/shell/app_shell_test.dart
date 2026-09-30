// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/core/app.dart";
import "package:rally_mobile/features/auth/domain/auth_user.dart";
import "package:rally_mobile/features/auth/presentation/auth_providers.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";
import "package:rally_mobile/features/home/presentation/home_page.dart";
import "package:rally_mobile/features/perfil/presentation/perfil_page.dart";
import "package:rally_mobile/features/quadras/presentation/quadras_providers.dart";
import "package:rally_mobile/features/replays/presentation/replays_page.dart";
import "package:rally_mobile/features/replays/presentation/replays_providers.dart";
import "package:rally_mobile/features/reservas/presentation/minhas_reservas_page.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";
import "package:rally_mobile/features/shell/presentation/app_shell.dart";

import "../../fakes/fake_auth_repository.dart";
import "../../fakes/fake_gestao_repository.dart" as gestao;
import "../../fakes/fake_quadras_repository.dart";
import "../../fakes/fake_replays_repository.dart";
import "../../fakes/fake_reservas_repository.dart";

/// Barra de navegação inferior — a única peça do app que nunca tinha sido
/// verificada. No navegador ela não respondia a cliques sintéticos, e ficou
/// em aberto se o problema era do alvo de toque ou da automação. Aqui o
/// toque é real do ponto de vista do framework: se a barra estivesse com o
/// alvo errado, estes testes falhariam.
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

  Future<void> abrirLogado(WidgetTester tester) async {
    // 360 x 1200 lógicos: o celular mais estreito que o app atende, que é
    // onde quatro abas numa linha têm menos folga.
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(
            FakeAuthRepository(
              sessaoInicial: const AuthUser(
                id: "u1",
                nome: "Lucas Ackermann",
                email: "lucas@rally.com",
              ),
            ),
          ),
          quadrasRepositoryProvider.overrideWithValue(
            FakeQuadrasRepository(quadras: [quadraFalsa(id: "q1")]),
          ),
          promocaoDestaqueProvider.overrideWith((ref) async => null),
          reservasRepositoryProvider.overrideWithValue(
            FakeReservasRepository(const []),
          ),
          replaysRepositoryProvider.overrideWithValue(
            FakeReplaysRepository(const []),
          ),
          gestaoRepositoryProvider.overrideWithValue(
            gestao.FakeGestaoRepository(estabelecimentos: const []),
          ),
        ],
        child: const RallyApp(),
      ),
    );
    // Passa pelo splash e cai na Home.
    await bombearAteSurgir(tester, find.byType(HomePage));

    // E espera a casca **parar de deslizar**. A Home já existe no meio da
    // transição, com a barra inteira deslocada para a direita — tocar ali
    // erra o alvo, e a aba mais à direita cai fora da tela. Não dá para usar
    // `pumpAndSettle`: as telas têm indicadores que nunca assentam.
    for (var i = 0; i < 40; i++) {
      if (tester.getRect(find.byType(AppShell)).left == 0) return;
      await tester.pump(const Duration(milliseconds: 50));
    }
    fail("A transição para a casca não terminou.");
  }

  testWidgets("as quatro abas cabem e respeitam o alvo de toque mínimo",
      (tester) async {
    await abrirLogado(tester);

    for (final rotulo in ["Início", "Reservas", "Replays", "Perfil"]) {
      final item = find.widgetWithText(InkWell, rotulo);
      expect(item, findsOneWidget, reason: "falta a aba $rotulo");

      // 44 x 44 é o mínimo do DESIGN.md — abaixo disso o dedo erra o alvo.
      final tamanho = tester.getSize(item);
      expect(tamanho.height, greaterThanOrEqualTo(44),
          reason: "a aba $rotulo tem ${tamanho.height}px de altura");
      expect(tamanho.width, greaterThanOrEqualTo(44),
          reason: "a aba $rotulo tem ${tamanho.width}px de largura");
    }
  });

  testWidgets("cada aba abre a sua tela", (tester) async {
    await abrirLogado(tester);

    await tester.tap(find.widgetWithText(InkWell, "Reservas"));
    await bombearAteSurgir(tester, find.byType(MinhasReservasPage));

    await tester.tap(find.widgetWithText(InkWell, "Replays"));
    await bombearAteSurgir(tester, find.byType(ReplaysPage));

    await tester.tap(find.widgetWithText(InkWell, "Perfil"));
    await bombearAteSurgir(tester, find.byType(PerfilPage));

    await tester.tap(find.widgetWithText(InkWell, "Início"));
    await bombearAteSurgir(tester, find.byType(HomePage));
  });

  testWidgets("a barra aguenta o texto ampliado do sistema", (tester) async {
    // Com a fonte do sistema em 1,5x os rótulos crescem meia vez. É
    // exatamente aí que a barra estourava — e o pedaço que sai da tela
    // deixa de receber toque, então a aba parecia "não funcionar".
    // Qualquer estouro de layout derruba o teste por si só.
    tester.platformDispatcher.textScaleFactorTestValue = 1.5;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await abrirLogado(tester);
    await tester.tap(find.widgetWithText(InkWell, "Perfil"));
    await bombearAteSurgir(tester, find.byType(PerfilPage));
  });

  testWidgets("trocar de aba não apaga o que estava na anterior",
      (tester) async {
    // É para isso que a casca usa `StatefulShellRoute.indexedStack`: se cada
    // aba fosse remontada, a busca digitada na Home sumiria a cada ida e
    // volta — e esse é o caminho de quem confere a reserva e volta a buscar.
    await abrirLogado(tester);

    await tester.enterText(find.byType(TextField), "Vila do Vôlei");
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.widgetWithText(InkWell, "Reservas"));
    await bombearAteSurgir(tester, find.byType(MinhasReservasPage));

    await tester.tap(find.widgetWithText(InkWell, "Início"));
    await bombearAteSurgir(tester, find.byType(HomePage));

    expect(find.text("Vila do Vôlei"), findsOneWidget);
  });
}
