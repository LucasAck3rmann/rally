// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:dio/dio.dart";
import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/features/privacidade/data/privacidade_repository_impl.dart";
import "package:rally_mobile/features/privacidade/domain/privacidade_repository.dart";

import "../../fakes/adaptador_falso.dart";

/// **Os direitos do titular, do lado do cliente (RNF-07).**
///
/// A tela tinha oito testes desde o #92 e o repositório, **zero** — e é ele
/// que decide o que vai dentro do arquivo que a pessoa baixa. Duas coisas aqui
/// não são formatação: o JSON é entregue **como a API o devolveu**, porque
/// remontá-lo no aplicativo seria reescrever o dado antes de entregá-lo; e a
/// recusa da exclusão chega com a mensagem da API, que é a única parte
/// acionável quando a pessoa é a última administradora de uma arena.
void main() {
  late AdaptadorFalso adaptador;
  late PrivacidadeRepositoryImpl repositorio;

  setUp(() {
    adaptador = AdaptadorFalso();
    repositorio = PrivacidadeRepositoryImpl(dioFalso(adaptador));
  });

  group("exportar", () {
    test("pede os dados e conta o que veio", () async {
      adaptador.responde({
        "geradoEm": "2026-10-14T20:00:00.000Z",
        "conta": {"nome": "Lucas"},
        "reservas": [{}, {}, {}],
        "avisos": [{}, {}],
      });

      final dados = await repositorio.exportar();

      expect(adaptador.pedidos.single.path, "/privacidade/meus-dados");
      expect(dados.reservas, 3);
      expect(dados.avisos, 2);
    });

    test("o JSON sai identado, porque é uma pessoa que vai abrir", () async {
      // JSON numa linha só é ilegível em qualquer visualizador, e o direito
      // de portabilidade não se cumpre entregando algo que ninguém lê.
      adaptador.responde({
        "conta": {"nome": "Lucas"}
      });

      final dados = await repositorio.exportar();

      expect(dados.json, contains("\n"));
      expect(dados.json, contains('  "conta"'));
    });

    test("entrega o conteúdo da API sem reescrever", () async {
      // Nenhum campo é renomeado, removido ou traduzido: o arquivo é o que a
      // API mandou. Se o aplicativo remontasse o objeto, a exportação
      // passaria a depender de o cliente conhecer todos os campos — e campo
      // novo na API sairia de fora sem ninguém notar.
      adaptador.responde({
        "observacao": "Não inclui senha.",
        "campoQueOAppNaoConhece": "preservado",
      });

      final dados = await repositorio.exportar();

      expect(dados.json, contains("campoQueOAppNaoConhece"));
      expect(dados.json, contains("Não inclui senha."));
    });

    test("sem reservas nem avisos, conta zero em vez de falhar", () async {
      adaptador.responde({
        "conta": {"nome": "Lucas"}
      });

      final dados = await repositorio.exportar();

      expect(dados.reservas, 0);
      expect(dados.avisos, 0);
    });

    test("corpo ausente devolve objeto vazio, não erro", () async {
      adaptador.responde(null);

      final dados = await repositorio.exportar();

      expect(dados.reservas, 0);
      expect(dados.bytes, greaterThan(0), reason: "ainda é um JSON válido");
    });

    test("falha traz a mensagem da API", () async {
      adaptador.falha(status: 500, corpo: {"message": "Falha ao montar."});

      await expectLater(
        repositorio.exportar(),
        throwsA(
          isA<PrivacidadeException>().having(
            (e) => e.message,
            "message",
            "Falha ao montar.",
          ),
        ),
      );
    });

    test("sem rede, a mensagem diz sem conexão", () async {
      adaptador.falha(tipo: DioExceptionType.connectionError);

      await expectLater(
        repositorio.exportar(),
        throwsA(
          isA<PrivacidadeException>().having(
            (e) => e.message,
            "message",
            contains("Sem conexão"),
          ),
        ),
      );
    });
  });

  group("excluir conta", () {
    test("chama DELETE na rota do titular", () async {
      adaptador.responde({"ok": true, "anonimizadoEm": "2026-10-14T20:00:00Z"});

      await repositorio.excluirConta();

      expect(adaptador.pedidos.single.path, "/privacidade/minha-conta");
      expect(adaptador.pedidos.single.method, "DELETE");
    });

    test("a recusa de última administradora chega inteira", () async {
      // **A asserção que mais importa.** A mensagem diz o que fazer; trocá-la
      // por texto genérico apagaria a única informação acionável, e a pessoa
      // tentaria de novo sem saber que precisa promover alguém antes.
      adaptador.falha(
        status: 409,
        corpo: {
          "message":
              "Você é o único administrador de Arena Beira-Rio. Promova outra "
                  "pessoa a administrador antes de excluir a conta.",
        },
      );

      await expectLater(
        repositorio.excluirConta(),
        throwsA(
          isA<PrivacidadeException>().having(
            (e) => e.message,
            "message",
            contains("Promova outra pessoa a administrador"),
          ),
        ),
      );
    });
  });
}
