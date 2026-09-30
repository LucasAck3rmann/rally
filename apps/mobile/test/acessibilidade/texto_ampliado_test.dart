// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_test/flutter_test.dart";
import "package:google_fonts/google_fonts.dart";
import "package:intl/date_symbol_data_local.dart";

import "cenario.dart";

/// **Texto ampliado do sistema, em todas as telas.**
///
/// Até 30/09 o app foi verificado num eixo só — largura de tela, a 360px.
/// Passava, e continuava quebrando para quem aumenta a fonte do aparelho:
/// nove estouros de layout em três dias, os três últimos visíveis apenas
/// aqui. Aumentar a fonte é o ajuste de acessibilidade mais usado, e um app
/// de reserva de quadra atende gente de todas as idades.
///
/// Cada teste só **renderiza** a tela: qualquer `RenderFlex` estourado vira
/// exceção e derruba a suíte sozinho, sem precisar de asserção. A lista de
/// telas mora em `cenario.dart`, compartilhada com o gate de leitor de tela.
void main() {
  setUpAll(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    await initializeDateFormatting("pt_BR");
  });

  for (final tela in telasDoApp) {
    testWidgets(tela.nome, (tester) async {
      await montarTela(tester, tela.constroi(), escalaTexto: 1.5);
      await bombearAteSurgir(tester, find.text(tela.ancora));
    });
  }
}
