// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";
import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";

import "cenario.dart";

/// **Leitor de tela: todo controle tocável precisa de nome (WCAG 4.1.2).**
///
/// Botão sem nome é anunciado pelo TalkBack como "botão", e mais nada. Quem
/// depende do leitor fica com uma tela cheia de botões indistinguíveis —
/// pior que uma tela sem botão nenhum, porque parece navegavel.
///
/// O gate caminha a árvore de semântica de cada tela, acha os nós com ação
/// de toque e exige rotulo ou tooltip em cada um. Campos de texto ficam de
/// fora: neles o nome vem do `labelText`, que o próprio Flutter expõe por
/// outro caminho.
void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    await initializeDateFormatting("pt_BR");
  });

  for (final tela in telasDoApp) {
    testWidgets(tela.nome, (tester) async {
      final handle = tester.ensureSemantics();
      await montarTela(tester, tela.constroi());
      await bombearAteSurgir(tester, find.text(tela.ancora));

      final achado = await _auditar(tester);
      handle.dispose();

      expect(
        achado.mudos,
        isEmpty,
        reason:
            "${tela.nome}: ${achado.mudos.length} controle(s) sem nome para "
            "o leitor de tela — ${achado.mudos.join(" | ")}",
      );

      // Sem esta linha, uma travessia quebrada passaria como tela perfeita:
      // zero controles achados e zero mudos dao o mesmo verde.
      if (tela.nome != "splash") {
        expect(
          achado.tocaveis,
          greaterThan(0),
          reason: "${tela.nome}: nenhum controle tocável encontrado — a "
              "travessia da árvore de semântica provavelmente quebrou",
        );
      }
    });
  }

  testWidgets("o gate morde: um controle sem nome é reprovado", (tester) async {
    // Prova que o detector funciona. Um gate que só sabe passar é
    // indistinguível de um gate quebrado.
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Row(
            children: [
              InkWell(
                  onTap: () {}, child: const SizedBox(width: 48, height: 48)),
              TextButton(onPressed: () {}, child: const Text("Com nome")),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    final achado = await _auditar(tester);
    handle.dispose();

    expect(achado.tocaveis, 2);
    expect(achado.mudos, hasLength(1));
  });
}

typedef _Achado = ({int tocaveis, List<String> mudos});

/// Caminha a árvore de semântica, rolando o que der para rolar.
///
/// A árvore só contém o que está **na tela**: sem rolar, a auditoria cobre a
/// primeira dobra e declara vitoria.
Future<_Achado> _auditar(WidgetTester tester) async {
  final mudos = <String>[];
  final vistos = <int>{};
  var tocaveis = 0;

  void visitar(SemanticsNode no) {
    final d = no.getSemanticsData();
    final ehCampo = d.flagsCollection.isTextField;
    if (d.hasAction(SemanticsAction.tap) && !ehCampo && vistos.add(no.id)) {
      tocaveis++;
      if (d.label.trim().isEmpty && d.tooltip.trim().isEmpty) {
        mudos.add("nó ${no.id} em ${no.rect.size}");
      }
    }
    no.visitChildren((filho) {
      visitar(filho);
      return true;
    });
  }

  final rolavel = find.byType(Scrollable);
  for (var volta = 0; volta < 12; volta++) {
    visitar(tester.getSemantics(find.byType(MaterialApp)));
    if (rolavel.evaluate().isEmpty) break;
    final estado = tester.state<ScrollableState>(rolavel.first);
    final antes = estado.position.pixels;
    await tester.drag(rolavel.first, const Offset(0, -600));
    await tester.pump(const Duration(milliseconds: 100));
    if (estado.position.pixels == antes) break;
  }

  return (tocaveis: tocaveis, mudos: mudos);
}
