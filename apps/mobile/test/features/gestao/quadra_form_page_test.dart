// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_test/flutter_test.dart";
import "package:go_router/go_router.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
import "package:rally_mobile/features/gestao/presentation/gestao_providers.dart";
import "package:rally_mobile/features/gestao/presentation/quadra_form_page.dart";

import "../../fakes/fake_gestao_repository.dart";

/// Cadastro e edição de quadra (RF-20).
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
    String? quadraId,
    FakeGestaoRepository? repositorio,
  }) async {
    // 360 x 1200 lógicos — a tela mais estreita que o app atende.
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repo = repositorio ?? FakeGestaoRepository();

    final router = GoRouter(
      initialLocation: "/form",
      routes: [
        GoRoute(
          path: "/form",
          builder: (_, __) => QuadraFormPage(
            estabelecimentoId: "e1",
            quadraId: quadraId,
          ),
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

  /// O formulário é mais alto que a tela, então quase nada está visível de
  /// início. Um toque fora da área visível não acontece — o framework
  /// avisa e segue em frente, e o teste falharia dizendo a coisa errada.
  Future<void> tocar(WidgetTester tester, Finder alvo) async {
    await tester.ensureVisible(alvo);
    await tester.pump();
    await tester.tap(alvo);
    await tester.pump();
  }

  /// Escreve num campo achando-o pelo rótulo, que é como o usuário o acha.
  Future<void> preencher(
    WidgetTester tester,
    String rotulo,
    String texto,
  ) async {
    final campo = find.widgetWithText(TextFormField, rotulo);
    await tester.ensureVisible(campo);
    await tester.pump();
    await tester.enterText(campo, texto);
    await tester.pump();
  }

  testWidgets("cadastro manda para a API o que foi preenchido", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Quadra do Fundo");
    await preencher(tester, "Preço por hora (R\$)", "90");
    await preencher(tester, "Capacidade (opcional)", "6");
    await tocar(tester, find.text("Beach Tennis"));
    await tocar(tester, find.text("Vestiário"));

    await tocar(tester, find.text("Cadastrar quadra"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.salvos, hasLength(1));
    final enviado = repo.salvos.single;
    expect(enviado.nome, "Quadra do Fundo");
    expect(enviado.precoHora, 90);
    expect(enviado.capacidade, 6);
    expect(enviado.modalidades, ["Beach Tennis"]);
    expect(enviado.comodidades, ["Vestiário"]);
  });

  testWidgets("sem modalidade não vai para a rede", (tester) async {
    // A modalidade não é campo de texto, então fica de fora do `validate()`
    // do formulário — é a checagem que mais tem chance de escapar.
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Quadra 9");
    await preencher(tester, "Preço por hora (R\$)", "80");

    await tocar(tester, find.text("Cadastrar quadra"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.salvos, isEmpty);
    expect(find.text("Escolha ao menos uma modalidade."), findsOneWidget);
  });

  testWidgets("nome curto demais é barrado antes da rede", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Q");
    await preencher(tester, "Preço por hora (R\$)", "80");
    await tocar(tester, find.text("Vôlei"));

    await tocar(tester, find.text("Cadastrar quadra"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.salvos, isEmpty);
    expect(find.text("O nome precisa de ao menos 2 letras."), findsOneWidget);
  });

  testWidgets("preço com vírgula vira decimal, não milhar", (tester) async {
    // "76,50" é como o teclado brasileiro entrega. Ler isso como 7650
    // erraria o preço em duas casas — e ninguém confere o que já enviou.
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Quadra 3");
    await preencher(tester, "Preço por hora (R\$)", "76,50");
    await tocar(tester, find.text("Futevôlei"));

    await tocar(tester, find.text("Cadastrar quadra"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.salvos.single.precoHora, 76.5);
  });

  testWidgets("edição chega com os valores da quadra já preenchidos",
      (tester) async {
    await abrir(
      tester,
      quadraId: "q1",
      repositorio: FakeGestaoRepository(
        quadras: [
          quadraFalsa(
            nome: "Quadra Coberta",
            precoHora: 140,
            modalidades: const ["Vôlei"],
          ),
        ],
      ),
    );

    await bombearAteSurgir(tester, find.text("Editar quadra"));
    expect(
      find.widgetWithText(TextFormField, "Quadra Coberta"),
      findsOneWidget,
    );
    expect(find.widgetWithText(TextFormField, "140"), findsOneWidget);
    expect(find.text("Salvar alterações"), findsOneWidget);
  });

  testWidgets("editar manda PATCH e não POST", (tester) async {
    final repo = FakeGestaoRepository(
      quadras: [quadraFalsa(nome: "Quadra Velha")],
    );
    await abrir(tester, quadraId: "q1", repositorio: repo);
    await bombearAteSurgir(tester, find.text("Editar quadra"));

    await preencher(tester, "Nome da quadra", "Quadra Nova");
    await tocar(tester, find.text("Salvar alterações"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.salvos.single.nome, "Quadra Nova");
    // A modalidade veio da quadra carregada, não de um toque do usuário.
    expect(repo.salvos.single.modalidades, ["Beach tennis"]);
  });

  testWidgets("faixa de preço vai junto no envio", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Quadra 5");
    await preencher(tester, "Preço por hora (R\$)", "80");
    await tocar(tester, find.text("Beach Tennis"));

    await tocar(tester, find.text("Adicionar faixa"));
    await preencher(tester, "R\$/h", "120");

    await tocar(tester, find.text("Cadastrar quadra"));
    await tester.pump(const Duration(milliseconds: 300));

    final faixas = repo.salvos.single.faixasPreco;
    expect(faixas, hasLength(1));
    expect(faixas.single.precoHora, 120);
    expect(faixas.single.horaInicio, "18:00");
    // Sem dia escolhido, a faixa vale para a semana inteira — que é o que
    // `null` significa no DTO, e não "domingo".
    expect(faixas.single.diaSemana, isNull);
  });

  testWidgets("remover a faixa tira ela do envio", (tester) async {
    final repo = await abrir(tester);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Quadra 6");
    await preencher(tester, "Preço por hora (R\$)", "80");
    await tocar(tester, find.text("Vôlei"));

    await tocar(tester, find.text("Adicionar faixa"));
    await tocar(tester, find.byTooltip("Remover faixa"));

    await tocar(tester, find.text("Cadastrar quadra"));
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.salvos.single.faixasPreco, isEmpty);
  });

  testWidgets("erro da API aparece sem perder o que foi digitado",
      (tester) async {
    // A sobreposição de faixas quem decide é o servidor. A tela precisa
    // mostrar a mensagem dele e continuar editável.
    final repo = FakeGestaoRepository()
      ..erroAoSalvar = Exception("As faixas de preço se sobrepõem.");
    await abrir(tester, repositorio: repo);
    await bombearAteSurgir(tester, find.text("Nova quadra"));

    await preencher(tester, "Nome da quadra", "Quadra 7");
    await preencher(tester, "Preço por hora (R\$)", "80");
    await tocar(tester, find.text("Beach Tennis"));

    await tocar(tester, find.text("Cadastrar quadra"));
    await bombearAteSurgir(
      tester,
      find.textContaining("As faixas de preço se sobrepõem."),
    );

    expect(find.widgetWithText(TextFormField, "Quadra 7"), findsOneWidget);
    expect(find.text("Cadastrar quadra"), findsOneWidget);
  });

  testWidgets("faixa que vale a semana toda não quebra ao carregar",
      (tester) async {
    // Regressão: `diaSemana` chegava como `null` da API — o caso mais comum
    // — e a leitura tratava o campo como obrigatório.
    await abrir(
      tester,
      quadraId: "q1",
      repositorio: FakeGestaoRepository(
        quadras: [
          const QuadraGestao(
            id: "q1",
            nome: "Quadra 1",
            precoHora: 80,
            ativo: true,
            modalidades: ["Vôlei"],
            fotos: [],
            comodidades: [],
            faixasPreco: [
              FaixaPreco(
                horaInicio: "18:00",
                horaFim: "22:00",
                precoHora: 120,
              ),
            ],
          ),
        ],
      ),
    );

    await bombearAteSurgir(tester, find.text("Editar quadra"));
    expect(find.text("Todos os dias"), findsWidgets);
  });
}
