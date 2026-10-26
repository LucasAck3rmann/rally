// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// **Os enums do aplicativo contra o `schema.prisma` de verdade.**
///
/// Quatro enums do app espelham enums da API, e cada um deles traz um membro
/// `desconhecido` — a correção do #104, para que valor novo da API não caia
/// pelo `_` num valor real. A correção faz o app **degradar com elegância**:
/// nada quebra, o rótulo diz "indisponível", e no caso do [PapelGestao] o
/// envio de volta falha alto em vez de rebaixar alguém.
///
/// É justamente por isso que ela esconde a divergência. Com o `desconhecido`
/// no lugar, a API pode ganhar um status novo e o app seguir funcionando
/// **sem que ninguém saiba** que ele não o conhece — a tela mostra "Status
/// indisponível" e a vida continua. Degradar bem e divergir são
/// indistinguíveis de dentro.
///
/// Este portão é o de fora. Ele lê o esquema e cobra que **todo valor que a
/// API nomeia seja reconhecido**, de modo que enum novo lá reprove aqui, no
/// lugar onde se decide o rótulo e o ícone.
///
/// **Era prometido e não existia.** O `gestao.dart` dizia, em comentário, que
/// a lista de papéis atribuíveis morava no enum "para que o portão
/// `enums_espelham_a_api_test.dart` possa cobrá-la contra o esquema" — e o
/// arquivo não existia. O que havia era a conferência contra uma lista
/// escrita à mão no próprio teste, que não é o esquema.
library;

import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";
import "package:rally_mobile/features/notificacoes/domain/notificacao.dart";
import "package:rally_mobile/features/reservas/domain/reserva.dart";

/// Os valores de um `enum` do `schema.prisma`, na ordem em que aparecem.
List<String> _doEsquema(String nome) {
  // O teste roda com o diretório de trabalho em `apps/mobile`.
  final arquivo = File("../api/prisma/schema.prisma");
  if (!arquivo.existsSync()) {
    fail(
      "Não achei ../api/prisma/schema.prisma a partir de ${Directory.current.path}. "
      "O caminho é parte do portão: se o esquema mudou de lugar, é melhor "
      "este teste falhar alto que deixar de conferir em silêncio.",
    );
  }

  final texto = arquivo.readAsStringSync();
  final bloco =
      RegExp("^enum $nome \\{\$(.*?)^\\}\$", multiLine: true, dotAll: true)
          .firstMatch(texto);
  if (bloco == null) {
    fail("O esquema não tem `enum $nome`. Ele foi renomeado ou removido?");
  }

  return bloco
      .group(1)!
      .split("\n")
      .map((l) => l.trim())
      .where((l) => l.isNotEmpty && !l.startsWith("//"))
      .toList();
}

void main() {
  group("o esquema é lido de verdade", () {
    test("os enums existem e têm valor dentro", () {
      // Âncora: sem ela, uma expressão regular que não casa nada faria todo
      // teste abaixo passar varrendo lista vazia — e o portão passaria a
      // provar o contrário do que promete.
      for (final nome in [
        "Role",
        "NotificacaoTipo",
        "ReservaStatus",
        "PagamentoStatus",
      ]) {
        expect(_doEsquema(nome), isNotEmpty, reason: "enum $nome vazio");
      }
      expect(_doEsquema("Role"), contains("MANTENEDOR"));
      expect(_doEsquema("ReservaStatus").length, greaterThan(4));
    });
  });

  group("todo valor da API é reconhecido pelo app", () {
    test("Role → PapelGestao, menos o CLIENTE", () {
      // `CLIENTE` existe na API e **não** chega aqui de propósito: o seletor
      // de gestão só lista vínculos de quem administra alguma coisa, e isso
      // está escrito no enum. Fica declarado como exceção em vez de a lista
      // simplesmente não o incluir.
      final daApi = _doEsquema("Role").where((v) => v != "CLIENTE");
      expect(daApi, isNotEmpty);

      for (final valor in daApi) {
        expect(
          PapelGestao.doTexto(valor),
          isNot(PapelGestao.desconhecido),
          reason: "a API nomeia Role.$valor e o app não o reconhece",
        );
      }

      // E o `CLIENTE` **cai** em desconhecido, que é o comportamento certo
      // para um papel que não administra: ele não tem lugar no painel.
      expect(PapelGestao.doTexto("CLIENTE"), PapelGestao.desconhecido);
    });

    test("NotificacaoTipo → NotificacaoTipo", () {
      final daApi = _doEsquema("NotificacaoTipo");
      expect(daApi, isNotEmpty);

      for (final valor in daApi) {
        final tipo = NotificacaoTipo.doTexto(valor);
        expect(
          tipo,
          isNot(NotificacaoTipo.desconhecido),
          reason: "a API nomeia NotificacaoTipo.$valor e o app não o reconhece",
        );
        // Todo tipo tem ícone: o `switch` do `icone` é exaustivo, e um membro
        // novo no enum não compila sem decidir qual.
        expect(tipo.icone, isNotEmpty, reason: "$valor ficou sem ícone");
      }
    });

    test(
        "o sino é compartilhado pelo lembrete e pelo desconhecido, de propósito",
        () {
      // A primeira versão deste portão cobrava "ícone próprio para cada
      // tipo", e reprovou no `LEMBRETE` — que usa o sino com razão. O erro era
      // da asserção, não do código: o sino genérico **é** a resposta certa
      // para o desconhecido, porque o aviso existe e deve aparecer, e esconder
      // a notificação seria pior que mostrá-la sem categoria.
      //
      // Então a colisão fica afirmada em vez de proibida. O que ela custa é
      // que um aviso de tipo novo pareça um lembrete, e isso é aceito: o
      // alternativa seria inventar um ícone de "não sei", que é pior.
      expect(NotificacaoTipo.lembrete.icone, "sino");
      expect(NotificacaoTipo.desconhecido.icone, "sino");

      // Fora dessas duas, cada tipo tem ícone só seu — e é isso que
      // "compartilhado por duas" quer dizer.
      final outros = NotificacaoTipo.values
          .where((t) => t != NotificacaoTipo.lembrete)
          .where((t) => t != NotificacaoTipo.desconhecido)
          .map((t) => t.icone)
          .toList();
      expect(outros.toSet().length, outros.length);
      expect(outros, isNot(contains("sino")));
    });

    test("ReservaStatus → ReservaStatus", () {
      final daApi = _doEsquema("ReservaStatus");
      expect(daApi, isNotEmpty);

      for (final valor in daApi) {
        final status = ReservaStatus.doTexto(valor);
        expect(
          status,
          isNot(ReservaStatus.desconhecido),
          reason: "a API nomeia ReservaStatus.$valor e o app não o reconhece",
        );
        // Rótulo próprio, e não o "Status indisponível" do desconhecido: é a
        // razão de o `switch` ser exaustivo, e o que obriga a decidir o texto
        // quando um status novo entra.
        expect(status.rotulo, isNot("Status indisponível"));
      }
    });

    test("PagamentoStatus → PagamentoStatus", () {
      // A consequência de errar aqui era a mais direta das quatro: `PENDENTE`
      // chegava pelo `_`, de modo que uma cobrança em qualquer estado novo
      // apareceria como "aguardando pagamento" para quem já pagou.
      final daApi = _doEsquema("PagamentoStatus");
      expect(daApi, isNotEmpty);

      for (final valor in daApi) {
        expect(
          PagamentoStatus.doTexto(valor),
          isNot(PagamentoStatus.desconhecido),
          reason: "a API nomeia PagamentoStatus.$valor e o app não o reconhece",
        );
      }
    });
  });

  group("o app não inventa valor que a API não tem", () {
    test("todo papel atribuível existe no Role do esquema", () {
      // **O que o comentário do `gestao.dart` prometia.** A conferência que
      // existia comparava `atribuiveis` com uma lista escrita à mão no
      // próprio teste; esta compara com o esquema.
      final daApi = _doEsquema("Role").toSet();

      for (final papel in PapelGestao.atribuiveis) {
        expect(daApi, contains(papel.paraApi),
            reason: "o menu oferece ${papel.paraApi}, que a API não tem");
      }
      // `MANTENEDOR` existe no esquema e **não** é oferecido: é papel de
      // plataforma, e o `PapelGuard` o recusa em toda rota de arena.
      expect(PapelGestao.atribuiveis, isNot(contains(PapelGestao.mantenedor)));
    });

    test("a convenção de dia da semana é a mesma nas duas superfícies", () {
      // **O engano que este teste existe para impedir.** O `DateTime.weekday`
      // do Dart vai de 1 (segunda) a 7 (domingo); a API valida `@Min(0)` e
      // `@Max(6)`, com domingo em 0. As duas convenções **concordam de
      // segunda a sexta** e só divergem no domingo, de modo que trocá-las
      // passa por qualquer teste que não olhe justamente esse dia — e o
      // sintoma seria o preço de domingo cobrado como o de sábado.
      //
      // Os limites são lidos do DTO da API, e não repetidos aqui: repetir
      // criaria a terceira cópia da mesma regra.
      final dto = File("../api/src/modules/gestao/dto/faixa-preco.dto.ts");
      if (!dto.existsSync()) {
        fail("Não achei o FaixaPrecoDto da API em ${dto.path}.");
      }
      final texto = dto.readAsStringSync();

      final minimo = RegExp(r"@Min\((\d+)\)").firstMatch(texto);
      final maximo = RegExp(r"@Max\((\d+)\)").firstMatch(texto);
      expect(minimo, isNotNull, reason: "o DTO perdeu o @Min");
      expect(maximo, isNotNull, reason: "o DTO perdeu o @Max");

      final dias = [
        for (var d = int.parse(minimo!.group(1)!);
            d <= int.parse(maximo!.group(1)!);
            d++)
          d,
      ];

      // Todo dia que a API aceita é oferecido pelo app, e nenhum a mais.
      expect(FaixaPreco.diasOferecidos.whereType<int>().toList(), dias);
      // E o `null` do app corresponde à coluna `Int?` do banco, que é
      // "todos os dias" — ele é oferecido além da faixa, não dentro dela.
      expect(FaixaPreco.diasOferecidos, contains(null));
      // O primeiro dia da faixa é domingo, e não segunda: é o que separa a
      // convenção da API da do Dart.
      expect(FaixaPreco.rotuloDoDia(dias.first), "Domingo");
    });

    test("a ida e volta de todo enum passa pelo texto da API", () {
      // Ida e volta por valor do **esquema**, e não pelos membros do enum: é
      // o que garante que o texto que o app manda de volta é o mesmo que a
      // API nomeia, letra por letra. Um `NO_SHOW` escrito `NOSHOW` passaria
      // por tudo acima e falharia só em produção.
      for (final valor in _doEsquema("Role").where((v) => v != "CLIENTE")) {
        expect(PapelGestao.doTexto(valor).paraApi, valor);
      }
    });
  });
}
