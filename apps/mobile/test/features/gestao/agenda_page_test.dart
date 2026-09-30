// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
import "package:rally_mobile/features/gestao/presentation/agenda_page.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";

import "../../fakes/fake_gestao_repository.dart";

/// Agenda do dia e bloqueio de horário no celular (RF-21, RN-09).
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
      initialLocation: "/agenda",
      routes: [
        GoRoute(
          path: "/agenda",
          builder: (_, __) => const AgendaPage(estabelecimentoId: "e1"),
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

  /// Acha a célula pelo que o leitor de tela anuncia — é o mesmo texto que
  /// descreve a célula para quem enxerga o card.
  Finder celula(String descricao) => find.bySemanticsLabel(descricao);

  /// Abre a folha de bloqueio e **espera ela parar de deslizar**.
  ///
  /// A folha aparece na árvore no primeiro quadro da animação, ainda fora da
  /// tela: tocar ali erra o alvo e o teste acusa "nada foi bloqueado", que
  /// culpa o código errado.
  Future<void> abrirFolha(WidgetTester tester, Finder alvo) async {
    await tester.tap(alvo);
    await bombearAteSurgir(tester, find.text("Bloquear horário"));
    var anterior = -1.0;
    for (var i = 0; i < 20; i++) {
      final topo = tester.getTopLeft(find.text("Bloquear horário")).dy;
      if (topo == anterior) return;
      anterior = topo;
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets("desenha as quadras e as horas do dia", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..agendaDoDia = agendaFalsa(itens: [itemDeAgendaFalso(hora: 19)]),
    );

    await bombearAteSurgir(tester, find.text("Quadra 1"));
    expect(find.text("Quadra 2"), findsOneWidget);
    expect(find.text("08h"), findsOneWidget);
    expect(find.text("22h"), findsOneWidget);
  });

  testWidgets("a faixa de horas cresce para caber o jogo fora dela",
      (tester) async {
    // Um jogo às 23h fora da janela padrão 8h–22h precisa aparecer; cortar
    // em 22h esconderia da agenda o horário mais disputado do verão.
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..agendaDoDia = agendaFalsa(itens: [itemDeAgendaFalso(hora: 23)]),
    );

    await bombearAteSurgir(tester, find.text("23h"));
  });

  testWidgets("mostra o cliente na reserva e o motivo no bloqueio",
      (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..agendaDoDia = agendaFalsa(
          itens: [
            itemDeAgendaFalso(hora: 19, clienteNome: "Augusto"),
            itemDeAgendaFalso(
              id: "b1",
              hora: 20,
              ehBloqueio: true,
              motivo: "Manutenção",
            ),
          ],
        ),
    );

    await bombearAteSurgir(tester, find.text("Augusto"));
    expect(find.text("Bloqueado"), findsOneWidget);
    expect(find.text("Manutenção"), findsOneWidget);
    // Bloqueio não mostra preço: não há cobrança, e "R$ 0" seria mentira.
    expect(find.text("R\$ 80"), findsOneWidget);
  });

  testWidgets("reserva de duas horas não repete o card na segunda linha",
      (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..agendaDoDia = agendaFalsa(
          itens: [itemDeAgendaFalso(hora: 19, duracaoHoras: 2)],
        ),
    );

    await bombearAteSurgir(tester, celula("19:00 reservado por Lucas"));
    expect(celula("Continuação de 19:00"), findsOneWidget);
    expect(find.text("Lucas"), findsOneWidget);
  });

  testWidgets("tocar em horário livre bloqueia e manda o motivo",
      (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, celula("Horário livre"));

    await abrirFolha(tester, celula("Horário livre").first);

    await tester.enterText(find.byType(TextField), "Manutenção da rede");
    await tester.tap(find.text("Bloquear"));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.bloqueios, hasLength(1));
    expect(repo.bloqueios.single.$1, "q1");
    expect(repo.bloqueios.single.$3, "Manutenção da rede");
  });

  testWidgets("cancelar a folha não bloqueia nada", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, celula("Horário livre"));

    await abrirFolha(tester, celula("Horário livre").first);
    await tester.tap(find.text("Cancelar"));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.bloqueios, isEmpty);
  });

  testWidgets("tocar num bloqueio pergunta antes de liberar", (tester) async {
    final repo = FakeGestaoRepository()
      ..agendaDoDia = agendaFalsa(
        itens: [itemDeAgendaFalso(id: "b1", hora: 19, ehBloqueio: true)],
      );
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, celula("19:00 bloqueado"));

    await tester.tap(celula("19:00 bloqueado"));
    await bombearAteSurgir(tester, find.text("Liberar 19:00?"));

    // Recusar mantém o bloqueio: liberar sem perguntar devolveria à venda um
    // horário que pode estar em manutenção de verdade.
    await tester.tap(find.text("Manter bloqueado"));
    await tester.pump(const Duration(milliseconds: 400));
    expect(repo.liberados, isEmpty);

    await tester.tap(celula("19:00 bloqueado"));
    await bombearAteSurgir(tester, find.text("Liberar 19:00?"));
    await tester.tap(find.text("Liberar"));
    await tester.pump(const Duration(milliseconds: 400));
    expect(repo.liberados, ["b1"]);
  });

  testWidgets("reserva de cliente não vira bloqueio por um toque",
      (tester) async {
    // Quem pagou perde o horário pelo cancelamento, que cobra motivo e
    // avisa — não por um toque na grade.
    final repo = FakeGestaoRepository()
      ..agendaDoDia = agendaFalsa(
        itens: [itemDeAgendaFalso(hora: 19, clienteNome: "Augusto")],
      );
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, celula("19:00 reservado por Augusto"));

    await tester.tap(celula("19:00 reservado por Augusto"));
    await tester.pump(const Duration(milliseconds: 400));

    expect(repo.bloqueios, isEmpty);
    expect(find.textContaining("está reservado"), findsOneWidget);
  });

  testWidgets("quem não é administrador não bloqueia", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository(
        estabelecimentos: [estabelecimentoFalso(papel: PapelGestao.atendente)],
      )..agendaDoDia = agendaFalsa(),
    );

    await bombearAteSurgir(tester, find.text("Quadra 1"));
    // A célula continua lá e legível — o atendente vê o dia, só não o muda.
    expect(celula("Horário livre"), findsWidgets);

    final semantica = tester.getSemantics(celula("Horário livre").first);
    expect(semantica.flagsCollection.isButton, isFalse);
  });

  testWidgets("erro ao bloquear aparece sem derrubar a tela", (tester) async {
    final repo = FakeGestaoRepository()
      ..erroAoSalvar = Exception("Esse horário já tem reserva.");
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, celula("Horário livre"));

    await abrirFolha(tester, celula("Horário livre").first);
    await tester.tap(find.text("Bloquear"));

    await bombearAteSurgir(
      tester,
      find.textContaining("Esse horário já tem reserva."),
    );
    expect(find.text("Quadra 1"), findsOneWidget);
  });

  testWidgets("sem quadra ativa, explica o que fazer", (tester) async {
    await abrir(
      tester,
      repositorio: FakeGestaoRepository()
        ..agendaDoDia = agendaFalsa(quadras: const []),
    );

    await bombearAteSurgir(tester, find.text("Nenhuma quadra ativa"));
  });
}
