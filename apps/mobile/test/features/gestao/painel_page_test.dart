// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/features/gestao/domain/painel.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";
import "package:rally_mobile/features/gestao/presentation/painel_page.dart";

import "../../fakes/fake_gestao_repository.dart";

/// Painel de ocupação, receita e próximos jogos (RF-22).
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
    // 360 x 1200 lógicos — a tela mais estreita que o app atende.
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repo = repositorio ?? FakeGestaoRepository();

    final router = GoRouter(
      initialLocation: "/painel",
      routes: [
        GoRoute(
          path: "/painel",
          builder: (_, __) => const PainelPage(estabelecimentoId: "e1"),
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

  testWidgets("separa o que entrou do que ainda pode não entrar",
      (tester) async {
    // Juntar caixa e a receber num número só faria um Pix pendente parecer
    // dinheiro que já entrou — e Pix pendente expira.
    await abrir(tester);

    await bombearAteSurgir(tester, find.text("R\$ 800"));
    expect(find.text("RECEBIDO NO PERÍODO"), findsOneWidget);
    expect(find.text("R\$ 240"), findsOneWidget);
    expect(find.text("R\$ 130"), findsOneWidget);
  });

  testWidgets("mostra ocupação, reservas e cancelamento", (tester) async {
    await abrir(tester);

    await bombearAteSurgir(tester, find.text("42,5%"));
    expect(find.text("8h de 98h"), findsOneWidget);
    expect(find.text("8"), findsOneWidget);
    expect(find.text("11,1%"), findsOneWidget);
  });

  testWidgets("sem horário cadastrado, a ocupação é um traço e não 0%",
      (tester) async {
    // "0%" afirmaria que a arena está vazia; o que não há é denominador.
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..painelDoPeriodo = painelFalso(
          ocupacao: null,
          horasDisponiveis: 0,
        ),
    );

    await bombearAteSurgir(tester, find.text("sem horário cadastrado"));
    expect(find.text("0%"), findsNothing);
  });

  testWidgets("sem venda, o ticket médio é um traço", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..painelDoPeriodo = painelFalso(ticketMedio: null, vendidas: 0),
    );

    await bombearAteSurgir(tester, find.text("TICKET MÉDIO"));
    expect(find.text("—"), findsWidgets);
  });

  testWidgets("o período escolhido chega até a consulta", (tester) async {
    // Olhar só a cor do chip deixaria passar um filtro que muda na tela e
    // não muda na chamada.
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("30 dias"));

    await tester.tap(find.text("30 dias"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.periodos, [7, 30]);
  });

  testWidgets("quadra parada aparece em vez de sumir", (tester) async {
    // É justamente a quadra sem reserva que o dono precisa enxergar.
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..painelDoPeriodo = painelFalso(
          quadras: const [
            QuadraNoPainel(
              quadraId: "q1",
              nome: "Quadra 1",
              reservas: 6,
              horasVendidas: 6,
              receita: 640,
              ocupacao: 40,
            ),
            QuadraNoPainel(
              quadraId: "q9",
              nome: "Quadra do Fundo",
              reservas: 0,
              horasVendidas: 0,
              receita: 0,
              ocupacao: 0,
            ),
          ],
        ),
    );

    await bombearAteSurgir(tester, find.text("Quadra do Fundo"));
    expect(find.text("Nenhuma reserva no período"), findsOneWidget);
  });

  testWidgets("marca quem já pagou e quem ainda vai pagar", (tester) async {
    await abrir(tester);

    await bombearAteSurgir(tester, find.text("Augusto Boff"));
    expect(find.text("PAGO"), findsOneWidget);
    expect(find.text("A PAGAR"), findsOneWidget);
    // Reserva sem cliente é de balcão, não um nome em branco.
    expect(find.text("Reserva de balcão"), findsOneWidget);
  });

  testWidgets("período sem movimento explica o vazio", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..painelDoPeriodo = painelFalso(
          vendidas: 0,
          canceladas: 0,
          bloqueios: 0,
          proximosJogos: const [],
        ),
    );

    await bombearAteSurgir(tester, find.text("Nenhum movimento no período"));
  });

  testWidgets("erro da API oferece tentar de novo", (tester) async {
    final repo = FakeGestaoRepository()
      ..erroAoSalvar = Exception("Sem conexão com o servidor");
    await abrir(tester, repositorio: repo);

    await bombearAteSurgir(tester, find.text("Não deu para carregar"));
    expect(find.text("Tentar de novo"), findsOneWidget);
  });
}
