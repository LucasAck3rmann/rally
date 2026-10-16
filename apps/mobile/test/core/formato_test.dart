// SPDX-License-Identifier: AGPL-3.0-or-later
import "package:flutter_test/flutter_test.dart";
import "package:intl/date_symbol_data_local.dart";
import "package:intl/intl.dart";
import "package:rally_mobile/core/formato.dart";

/// **O formato que vai para a API não depende do idioma de quem usa (RNF-14).**
///
/// `Formato.dataIso` monta o `YYYY-MM-DD` que viaja na URL das rotas de
/// disponibilidade e de agenda. Ele usava `DateFormat("yyyy-MM-dd")` **sem
/// locale**, caindo no `Intl.defaultLocale` do ambiente.
///
/// Hoje isso funciona, e é justamente o que torna o caso traiçoeiro: o padrão
/// dá dígito ASCII, então nada quebra — até alguém localizar o aplicativo.
/// Formato de máquina não é preferência de quem lê, e por isso o locale dele
/// se declara. A web já fazia isso, usando `en-CA` para montar o mesmo
/// formato; o aplicativo não fazia.
void main() {
  setUpAll(initializeDateFormatting);

  final data = DateTime(2026, 10, 16);

  tearDown(() => Intl.defaultLocale = null);

  test("monta a data no formato que a API espera", () {
    expect(Formato.dataIso(data), "2026-10-16");
  });

  test("não muda quando o locale padrão do ambiente muda", () {
    // pt_BR é o caso real do aplicativo, que chama
    // `initializeDateFormatting("pt_BR")` no `main`.
    Intl.defaultLocale = "pt_BR";
    expect(Formato.dataIso(data), "2026-10-16");
  });

  test("resiste a locale de dígito não-latino", () {
    // É o caso que a declaração do locale existe para cobrir. Se o parâmetro
    // saísse com dígito árabe-oriental, a API receberia texto que não é data
    // — e o erro apareceria só para quem usasse o aplicativo nesse idioma.
    for (final locale in ["ar", "fa", "ne"]) {
      Intl.defaultLocale = locale;
      expect(
        Formato.dataIso(data),
        "2026-10-16",
        reason: "a data da API mudou sob o locale $locale",
      );
      expect(
        RegExp(r"^\d{4}-\d{2}-\d{2}$").hasMatch(Formato.dataIso(data)),
        isTrue,
        reason: "dígito fora de ASCII sob o locale $locale",
      );
    }
  });

  test("o dinheiro, ao contrário, é pt-BR de propósito", () {
    // Moeda **é** exibição: a vírgula decimal e o R$ são o que o usuário
    // brasileiro espera ler. A distinção entre formato de máquina e formato
    // de leitura é a razão de um fixar `en_US` e o outro fixar `pt_BR`.
    expect(Formato.moeda(80), "R\$ 80");
    expect(Formato.moeda(76.5), "R\$ 76,50");
  });
}
