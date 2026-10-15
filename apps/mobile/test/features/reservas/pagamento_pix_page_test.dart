// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/features/reservas/domain/reserva.dart";
import "package:rally_mobile/features/reservas/presentation/pagamento_pix_page.dart";
import "package:rally_mobile/features/reservas/presentation/reservas_providers.dart";

import "../../fakes/fake_reservas_repository.dart";

/// Pagamento Pix: a tela onde o cliente espera a cobrança cair.
void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    await initializeDateFormatting("pt_BR");
  });

  /// Guarda o que a tela mandou para a área de transferência.
  late List<String> copiado;

  setUp(() {
    copiado = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (chamada) async {
      if (chamada.method == "Clipboard.setData") {
        copiado.add((chamada.arguments as Map)["text"] as String);
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
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

  Future<void> abrir(WidgetTester tester, FakeReservasRepository repo) async {
    tester.view.physicalSize = const Size(1200, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final router = GoRouter(
      initialLocation: "/reservas/r1/pagamento",
      routes: [
        GoRoute(
          path: "/reservas/:id/pagamento",
          builder: (_, state) =>
              PagamentoPixPage(reservaId: state.pathParameters["id"]!),
        ),
        GoRoute(
          path: "/reservas/:id/confirmacao",
          builder: (_, __) => const Scaffold(body: Text("comprovante")),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [reservasRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
  }

  testWidgets("mostra o valor e o código copia e cola", (tester) async {
    await abrir(
      tester,
      FakeReservasRepository([reservaFalsa(pagamento: pagamentoFalso())]),
    );

    await bombearAteSurgir(tester, find.textContaining("R\$ 76"));
    expect(find.textContaining("00020126BR.GOV.BCB.PIX"), findsOneWidget);
  });

  testWidgets("copiar põe o código na área de transferência", (tester) async {
    const codigo = "00020126PIX-COPIA-E-COLA-DO-TESTE";
    await abrir(
      tester,
      FakeReservasRepository([
        reservaFalsa(pagamento: pagamentoFalso(pixCopiaCola: codigo)),
      ]),
    );
    await bombearAteSurgir(tester, find.textContaining("PIX-COPIA-E-COLA"));

    await tester.tap(find.text("COPIAR"));
    await tester.pump(const Duration(milliseconds: 200));

    // É o gesto principal desta tela: sem o código na mão, não há pagamento.
    expect(copiado, [codigo]);
    await bombearAteSurgir(
      tester,
      find.widgetWithText(SnackBar, "Código copiado."),
    );
  });

  testWidgets("anuncia a cobrança expirada", (tester) async {
    await abrir(
      tester,
      FakeReservasRepository([
        reservaFalsa(pagamento: pagamentoFalso(minutosAteExpirar: -1)),
      ]),
    );

    await bombearAteSurgir(tester, find.text("COBRANÇA EXPIRADA"));
  });

  testWidgets("vai direto ao comprovante quando a cobrança já está paga", (
    tester,
  ) async {
    // É o caminho do webhook: se o pagamento caiu antes da tela abrir, não
    // faz sentido mostrar QR code para ninguém.
    await abrir(
      tester,
      FakeReservasRepository([
        reservaFalsa(pagamento: pagamentoFalso(status: PagamentoStatus.pago)),
      ]),
    );

    await bombearAteSurgir(tester, find.text("comprovante"));
  });

  testWidgets("'já paguei' com cobrança pendente avisa que ainda não caiu", (
    tester,
  ) async {
    await abrir(
      tester,
      FakeReservasRepository([reservaFalsa(pagamento: pagamentoFalso())]),
    );
    await bombearAteSurgir(tester, find.text("Já paguei"));

    await tester.tap(find.text("Já paguei"));
    await bombearAteSurgir(
      tester,
      find.widgetWithText(
        SnackBar,
        "Ainda não identificamos o pagamento. Assim que cair, a gente avisa.",
      ),
    );
    // E o cliente continua na tela, com o código ainda à mão.
    expect(find.byType(PagamentoPixPage), findsOneWidget);
  });
}
