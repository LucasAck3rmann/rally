// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:dio/dio.dart";
import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/quadras/data/quadras_repository_impl.dart";

import "../../fakes/adaptador_falso.dart";

/// **A camada que fala com a API, que estava sem nenhuma cobertura.**
///
/// A medição de 14/10 mostrou os `*_repository_impl.dart` em **0%**: os 206
/// testes de widget usam repositórios falsos, de modo que a camada que faz a
/// requisição e desserializa a resposta nunca era exercitada. A consequência
/// é concreta — **um campo renomeado na API quebra o aplicativo em uso com os
/// 206 testes passando**, e no pior caso não quebra: entrega um valor errado
/// em silêncio, porque vários campos têm valor padrão.
///
/// É por isso que esta suíte prende **os nomes dos campos** e não só o
/// formato. Se a API passar a mandar `descontoPix` em vez de
/// `descontoPixPct`, o desconto vira zero sem nenhum erro, e o cliente paga a
/// mais sem que nada acuse.
void main() {
  late AdaptadorFalso adaptador;
  late QuadrasRepositoryImpl repositorio;

  setUp(() {
    adaptador = AdaptadorFalso();
    repositorio = QuadrasRepositoryImpl(dioFalso(adaptador));
  });

  Map<String, dynamic> quadraJson({Map<String, dynamic> extras = const {}}) {
    return {
      "id": "q1",
      "nome": "Quadra 1",
      "precoHora": 80,
      "fotos": ["https://exemplo/1.jpg"],
      "modalidades": ["Beach Tennis", "Futevôlei"],
      "capacidade": 4,
      "aoVivo": true,
      "estabelecimento": {
        "id": "e1",
        "nome": "Arena Beira-Rio",
        "bairro": "Centro",
        "cidade": "Sapiranga",
        "uf": "RS",
        "nota": 4.7,
        "avaliacoes": 31,
        "descontoPixPct": 5,
      },
      ...extras,
    };
  }

  group("listar", () {
    test("pede /quadras e desserializa a lista", () async {
      adaptador.responde([quadraJson()]);

      final quadras = await repositorio.listar();

      expect(adaptador.pedidos.single.path, "/quadras");
      expect(adaptador.pedidos.single.method, "GET");
      expect(quadras, hasLength(1));
      expect(quadras.single.nome, "Quadra 1");
      expect(quadras.single.precoHora, 80);
      expect(quadras.single.estabelecimento.nome, "Arena Beira-Rio");
    });

    test("manda modalidade e busca só quando existem", () async {
      // O `if` dentro do mapa de parâmetros é a única lógica do método, e
      // mandar `modalidade=null` faria a API filtrar por texto nulo.
      adaptador.responde(<dynamic>[]);
      await repositorio.listar();
      expect(adaptador.pedidos.last.queryParameters, isEmpty);

      adaptador.responde(<dynamic>[]);
      await repositorio.listar(modalidade: "Futevôlei", busca: "beira");
      expect(adaptador.pedidos.last.queryParameters, {
        "modalidade": "Futevôlei",
        "busca": "beira",
      });
    });

    test("busca vazia não vai como filtro", () async {
      // O campo de busca manda "" quando a pessoa apaga o que digitou.
      // Enviar `busca=` faria a API procurar pela string vazia.
      adaptador.responde(<dynamic>[]);

      await repositorio.listar(busca: "");

      expect(adaptador.pedidos.single.queryParameters, isEmpty);
    });

    test("corpo nulo devolve lista vazia, e não erro", () async {
      // A API devolve `[]`, mas um proxy pode devolver corpo vazio. O `?? []`
      // existe para isso, e sem teste ninguém sabe se ele funciona.
      adaptador.responde(null);

      expect(await repositorio.listar(), isEmpty);
    });
  });

  group("desserialização — os nomes dos campos", () {
    test("campos opcionais ausentes caem nos padrões certos", () async {
      // Este é o teste que importa. Cada `??` aqui é um valor que o
      // aplicativo mostra como se fosse dado da arena.
      adaptador.responde([
        {
          "id": "q2",
          "nome": "Quadra 2",
          "precoHora": 60,
          "estabelecimento": {"id": "e1", "nome": "Arena"},
        },
      ]);

      final q = (await repositorio.listar()).single;

      expect(q.fotos, isEmpty);
      expect(q.modalidades, isEmpty);
      expect(q.comodidades, isEmpty);
      expect(q.capacidade, isNull);
      expect(q.descricao, isNull);
      expect(q.aoVivo, isFalse, reason: "sem o campo, não há jogo ao vivo");
      expect(q.fotoPrincipal, isNull);
      expect(q.estabelecimento.avaliacoes, 0);
      expect(q.estabelecimento.nota, isNull);
      expect(
        q.estabelecimento.descontoPixPct,
        0,
        reason: "sem o campo, desconto zero — nunca um valor inventado",
      );
    });

    test("preço inteiro vira double, porque a API manda os dois", () async {
      // `80` e `80.0` chegam como `int` e `double` no JSON. Sem o `as num`,
      // um dos dois estoura em tempo de execução.
      adaptador.responde([
        quadraJson(extras: {"precoHora": 75})
      ]);
      expect((await repositorio.listar()).single.precoHora, 75.0);

      adaptador.responde([
        quadraJson(extras: {"precoHora": 82.5})
      ]);
      expect((await repositorio.listar()).single.precoHora, 82.5);
    });

    test("a localização junta bairro e cidade, pulando o que falta", () async {
      adaptador.responde([quadraJson()]);
      expect(
        (await repositorio.listar()).single.estabelecimento.localizacao,
        "Centro · Sapiranga",
      );

      adaptador.responde([
        quadraJson(
          extras: {
            "estabelecimento": {
              "id": "e1",
              "nome": "Arena",
              "cidade": "Sapiranga",
            },
          },
        ),
      ]);
      expect(
        (await repositorio.listar()).single.estabelecimento.localizacao,
        "Sapiranga",
        reason: "sem bairro, não sobra o separador solto",
      );
    });

    test("campo obrigatório ausente falha alto, e não em silêncio", () async {
      // `id` e `nome` não têm padrão de propósito: quadra sem identificador
      // não é quadra, e deixar `null` passar espalharia o problema até uma
      // tela qualquer, longe da causa.
      adaptador.responde([
        {"nome": "Sem id", "precoHora": 10, "estabelecimento": {}},
      ]);

      expect(repositorio.listar(), throwsA(isA<TypeError>()));
    });
  });

  group("detalhe e disponibilidade", () {
    test("detalhe monta o caminho com o id", () async {
      adaptador.responde(quadraJson(extras: {"descricao": "Areia fina"}));

      final q = await repositorio.detalhe("q1");

      expect(adaptador.pedidos.single.path, "/quadras/q1");
      expect(q.descricao, "Areia fina");
    });

    test("disponibilidade manda a data e converte os horários", () async {
      adaptador.responde({
        "data": "2026-10-20",
        "slotMinutos": 60,
        "slots": [
          {
            "inicio": "2026-10-20T22:00:00.000Z",
            "fim": "2026-10-20T23:00:00.000Z",
            "hora": "19:00",
            "disponivel": true,
            "preco": 90,
          },
        ],
      });

      final grade = await repositorio.disponibilidade("q1", "2026-10-20");

      expect(adaptador.pedidos.single.path, "/quadras/q1/disponibilidade");
      expect(adaptador.pedidos.single.queryParameters, {"data": "2026-10-20"});
      expect(grade.slots.single.hora, "19:00");
      expect(grade.slots.single.preco, 90);
      // O rótulo vem pronto da API, no fuso do estabelecimento; o `DateTime`
      // é convertido para local. Confiar no `inicio` para montar o rótulo
      // mostraria a hora do aparelho, que pode estar noutro fuso.
      expect(grade.slots.single.inicio.isUtc, isFalse);
    });
  });

  group("erro", () {
    test("usa a mensagem que a API escreveu", () async {
      adaptador.falha(status: 409, corpo: {"message": "Horário já reservado."});

      await expectLater(
        repositorio.detalhe("q1"),
        throwsA(
          isA<ApiException>()
              .having((e) => e.mensagem, "mensagem", "Horário já reservado.")
              .having((e) => e.status, "status", 409),
        ),
      );
    });

    test("mensagem em lista usa a primeira, que é a do validador", () async {
      adaptador.falha(
        status: 400,
        corpo: {
          "message": ["A data é obrigatória.", "e mais uma"],
        },
      );

      await expectLater(
        repositorio.disponibilidade("q1", ""),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            "A data é obrigatória.",
          ),
        ),
      );
    });

    test("rede caída diz sem conexão, e não o erro padrão da tela", () async {
      // A distinção decide o que a pessoa faz: "sem conexão" ela resolve
      // ligando o wi-fi; "não foi possível carregar" ela tenta de novo no
      // mesmo lugar e falha igual.
      adaptador.falha(tipo: DioExceptionType.connectionError);

      await expectLater(
        repositorio.listar(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            "Sem conexão com o servidor.",
          ),
        ),
      );
    });

    test("tempo esgotado também é sem conexão", () async {
      adaptador.falha(tipo: DioExceptionType.receiveTimeout);

      await expectLater(
        repositorio.listar(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            contains("Sem conexão"),
          ),
        ),
      );
    });

    test("erro sem mensagem legível cai no texto da própria tela", () async {
      // 502 de proxy vem em HTML. O texto padrão é específico por método —
      // "carregar as quadras" e não "erro" — e é o que a tela mostra.
      adaptador.falha(status: 502, corpo: "<html>Bad Gateway</html>");

      await expectLater(
        repositorio.listar(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            "Não foi possível carregar as quadras.",
          ),
        ),
      );
    });

    test("mensagem vazia na resposta não vira mensagem vazia na tela",
        () async {
      // `{"message": ""}` passaria pelo `is String` e deixaria a tela sem
      // texto nenhum. O `isNotEmpty` existe para isso.
      adaptador.falha(status: 500, corpo: {"message": ""});

      await expectLater(
        repositorio.listar(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            "Não foi possível carregar as quadras.",
          ),
        ),
      );
    });
  });
}
