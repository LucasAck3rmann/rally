// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:dio/dio.dart";
import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/gestao/data/gestao_repository_impl.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";

import "../../fakes/adaptador_falso.dart";

/// **O maior arquivo sem cobertura do aplicativo: 100 linhas, 0%.**
///
/// Quatorze métodos, e o que eles têm em comum é a propriedade que esta suíte
/// existe para prender: **toda rota de gestão carrega o estabelecimento que
/// foi pedido**. É o isolamento multi-inquilino do ADR-0011 visto do lado do
/// cliente — a API o garante pelo `PapelGuard`, que lê o vínculo do usuário
/// com o estabelecimento **da rota**, então um identificador trocado aqui não
/// vaza dado: faz o aplicativo pedir a arena errada e receber 404. O que
/// quebra é a tela, em silêncio, e é o tipo de erro que o compilador não
/// pega porque todos os identificadores são `String`.
///
/// É o análogo do `identidade-do-token.spec.ts` da API: uma propriedade dita
/// uma vez, verificada em todas as rotas que a compartilham.
void main() {
  late AdaptadorFalso adaptador;
  late GestaoRepositoryImpl repositorio;

  setUp(() {
    adaptador = AdaptadorFalso();
    repositorio = GestaoRepositoryImpl(dioFalso(adaptador));
  });

  const arena = "e-da-arena";
  const outra = "e-de-outra-arena";

  Map<String, dynamic> quadraJson() => {
        "id": "q1",
        "nome": "Quadra 1",
        "precoHora": 80,
        "modalidades": ["Beach Tennis"],
        "ativo": true,
      };

  Map<String, dynamic> membroJson({String papel = "ATENDENTE"}) => {
        "usuarioId": "u2",
        "nome": "Augusto Boff",
        "email": "augusto@rally.com.br",
        "papel": papel,
        "desde": "2026-09-01T12:00:00.000Z",
      };

  group("toda rota leva o estabelecimento pedido", () {
    test("e nenhuma leva outro", () async {
      // Percorre as rotas que recebem o identificador e confere que ele
      // aparece no caminho — e que o de **outra** arena nunca aparece. Se
      // alguém trocar a ordem de dois parâmetros `String`, isto reprova.
      adaptador.responde([quadraJson()]);
      await repositorio.quadras(arena);

      adaptador.responde(quadraJson());
      await repositorio.detalheQuadra(arena, "q1");

      adaptador.responde({"data": "2026-10-20", "itens": <dynamic>[]});
      await repositorio.agenda(arena, "2026-10-20");

      adaptador.responde([membroJson()]);
      await repositorio.equipe(arena);

      adaptador.responde(<String, dynamic>{});
      await repositorio.removerMembro(arena, "u2");

      adaptador.responde(quadraJson());
      await repositorio.definirAtivo(arena, "q1", ativo: false);

      expect(adaptador.pedidos, hasLength(6));
      for (final pedido in adaptador.pedidos) {
        expect(
          pedido.path,
          contains(arena),
          reason: "${pedido.method} ${pedido.path} perdeu o estabelecimento",
        );
        expect(pedido.path, isNot(contains(outra)));
      }
    });

    test("o identificador da quadra não troca de lugar com o da arena",
        () async {
      // Os dois são `String`: trocados, a requisição vai para
      // `/estabelecimentos/q1/quadras/e-da-arena` e o compilador não acusa.
      adaptador.responde(quadraJson());

      await repositorio.detalheQuadra(arena, "q1");

      expect(
        adaptador.pedidos.single.path,
        "/gestao/estabelecimentos/$arena/quadras/q1",
      );
    });

    test("meusEstabelecimentos é a única rota sem identificador", () async {
      // Ela é o que **descobre** os vínculos; exigir o identificador aqui
      // seria pedir o que a pessoa ainda não sabe.
      adaptador.responde([
        {"id": arena, "nome": "Arena Beira-Rio", "meuPapel": "ADMIN"},
      ]);

      final lista = await repositorio.meusEstabelecimentos();

      expect(adaptador.pedidos.single.path, "/gestao/estabelecimentos");
      expect(lista.single.id, arena);
      expect(lista.single.meuPapel, PapelGestao.admin);
    });
  });

  group("quadras", () {
    test("criar manda o corpo do formulário, sem campo vazio", () async {
      // `descricao` e `capacidade` só vão quando existem: mandar `null` faria
      // o validador da API recusar, e a pessoa veria erro ao salvar uma
      // quadra sem descrição, que é o caso comum.
      adaptador.responde(quadraJson());

      await repositorio.criarQuadra(
        arena,
        const DadosQuadra(
          nome: "Quadra 3",
          precoHora: 70,
          modalidades: ["Futevôlei"],
        ),
      );

      final corpo = adaptador.pedidos.single.data as Map<String, dynamic>;
      expect(adaptador.pedidos.single.method, "POST");
      expect(corpo["nome"], "Quadra 3");
      expect(corpo["precoHora"], 70);
      expect(corpo["modalidades"], ["Futevôlei"]);
      expect(corpo.containsKey("descricao"), isFalse);
      expect(corpo.containsKey("capacidade"), isFalse);
      expect(corpo["faixasPreco"], isEmpty);
    });

    test("descrição vazia conta como ausente", () async {
      // O campo manda "" quando a pessoa apaga o que escreveu.
      adaptador.responde(quadraJson());

      await repositorio.criarQuadra(
        arena,
        const DadosQuadra(
          nome: "Q",
          precoHora: 50,
          modalidades: [],
          descricao: "",
        ),
      );

      final corpo = adaptador.pedidos.single.data as Map<String, dynamic>;
      expect(corpo.containsKey("descricao"), isFalse);
    });

    test("as faixas de preço vão serializadas", () async {
      adaptador.responde(quadraJson());

      await repositorio.criarQuadra(
        arena,
        const DadosQuadra(
          nome: "Q",
          precoHora: 50,
          modalidades: [],
          faixasPreco: [
            FaixaPreco(
              diaSemana: 5,
              horaInicio: "18:00",
              horaFim: "22:00",
              precoHora: 110,
            ),
          ],
        ),
      );

      final corpo = adaptador.pedidos.single.data as Map<String, dynamic>;
      expect(corpo["faixasPreco"], [
        {
          "diaSemana": 5,
          "horaInicio": "18:00",
          "horaFim": "22:00",
          "precoHora": 110.0,
        },
      ]);
    });

    test("atualizar usa PATCH, e não POST", () async {
      // PATCH é o que a API expõe para edição; POST criaria uma segunda
      // quadra com o mesmo nome.
      adaptador.responde(quadraJson());

      await repositorio.atualizarQuadra(
        arena,
        "q1",
        const DadosQuadra(nome: "Q", precoHora: 80, modalidades: []),
      );

      expect(adaptador.pedidos.single.method, "PATCH");
      expect(
        adaptador.pedidos.single.path,
        "/gestao/estabelecimentos/$arena/quadras/q1",
      );
    });

    test("pausar e reativar mandam só o `ativo`, com mensagens diferentes",
        () async {
      // O mesmo método serve às duas ações, e o texto do erro muda — quem
      // tentou pausar precisa ler "pausar", não "reativar".
      adaptador.responde(quadraJson());
      await repositorio.definirAtivo(arena, "q1", ativo: false);
      expect(adaptador.pedidos.single.data, {"ativo": false});

      adaptador.falha(tipo: DioExceptionType.connectionTimeout);
      await expectLater(
        repositorio.definirAtivo(arena, "q1", ativo: true),
        throwsA(isA<ApiException>()),
      );
    });

    test("falha ao pausar diz pausar; ao reativar, reativar", () async {
      adaptador.falha(status: 500, corpo: "<html>");
      await expectLater(
        repositorio.definirAtivo(arena, "q1", ativo: false),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            contains("pausar"),
          ),
        ),
      );

      adaptador.falha(status: 500, corpo: "<html>");
      await expectLater(
        repositorio.definirAtivo(arena, "q1", ativo: true),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            contains("reativar"),
          ),
        ),
      );
    });
  });

  group("equipe", () {
    test("adicionar manda e-mail e o papel no formato da API", () async {
      adaptador.responde(membroJson(papel: "FINANCEIRO"));

      final membro = await repositorio.adicionarMembro(
        arena,
        email: "augusto@rally.com.br",
        papel: PapelGestao.financeiro,
      );

      expect(adaptador.pedidos.single.data, {
        "email": "augusto@rally.com.br",
        "papel": "FINANCEIRO",
      });
      expect(membro.papel, PapelGestao.financeiro);
    });

    test("os quatro papéis convertem nos dois sentidos", () async {
      // `paraApi` é o inverso de `doTexto`, e um desalinho entre os dois faria
      // a troca de papel gravar outro papel — silenciosamente, porque a API
      // aceitaria o texto e devolveria o que gravou.
      //
      // `desconhecido` fica fora porque não é papel da API: ele não tem texto
      // para onde voltar, e `paraApi` lança nele de propósito — é o que
      // impede um papel que o aplicativo não soube ler de ser reenviado como
      // outro. O teste do enum cobre esse caso em separado.
      final daApi =
          PapelGestao.values.where((p) => p != PapelGestao.desconhecido);
      expect(daApi.length, 4);
      for (final papel in daApi) {
        adaptador.responde(membroJson(papel: papel.paraApi));

        final membro = await repositorio.trocarPapel(arena, "u2", papel);

        expect(adaptador.pedidos.last.data, {"papel": papel.paraApi});
        expect(membro.papel, papel, reason: papel.paraApi);
      }
    });

    test("papel desconhecido vira `desconhecido`, e não `atendente`", () async {
      // **Este teste afirmava `atendente`, e o argumento dele estava certo
      // pela metade.** Ele dizia que o padrão era seguro porque papel novo
      // faz a tela esconder botões em vez de mostrar botões indevidos — o
      // que vale para *leitura*, e `desconhecido` preserva essa propriedade
      // (`podeEditarQuadras` é falso nele).
      //
      // O que faltava: o papel **volta para a API** em `paraApi`, no menu de
      // troca. Lido como `atendente` e reenviado, ele gravaria `ATENDENTE`
      // sobre o papel real — erro de leitura virando escrita que rebaixa
      // alguém. `desconhecido` não tem texto para enviar, e lança se alguém
      // tentar.
      adaptador.responde([
        {"id": arena, "nome": "A", "meuPapel": "PAPEL_QUE_NAO_EXISTE"},
      ]);

      final lista = await repositorio.meusEstabelecimentos();

      expect(lista.single.meuPapel, PapelGestao.desconhecido);
      expect(lista.single.meuPapel.podeEditarQuadras, isFalse);
      expect(lista.single.meuPapel.podeEditarQuadras, isFalse);
    });

    test("papel ausente também vira `desconhecido`", () async {
      // Campo que a API deveria mandar e não mandou é quebra de contrato, e
      // `desconhecido` é o que diz isso. Escolher um papel plausível no
      // lugar esconderia o defeito da API atrás de uma tela que funciona.
      adaptador.responde([
        {"id": arena, "nome": "A"},
      ]);

      expect(
        (await repositorio.meusEstabelecimentos()).single.meuPapel,
        PapelGestao.desconhecido,
      );
    });

    test("remover usa DELETE", () async {
      adaptador.responde(<String, dynamic>{});

      await repositorio.removerMembro(arena, "u2");

      expect(adaptador.pedidos.single.method, "DELETE");
      expect(
        adaptador.pedidos.single.path,
        "/gestao/estabelecimentos/$arena/equipe/u2",
      );
    });

    test("a recusa do último administrador chega com a mensagem", () async {
      adaptador.falha(
        status: 409,
        corpo: {
          "message": "O estabelecimento ficaria sem administrador.",
        },
      );

      await expectLater(
        repositorio.trocarPapel(arena, "u1", PapelGestao.atendente),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            "O estabelecimento ficaria sem administrador.",
          ),
        ),
      );
    });
  });

  group("painel e agenda", () {
    test("o painel manda os dias como parâmetro", () async {
      adaptador.responde({
        "periodo": {"de": "2026-10-08", "ate": "2026-10-14", "dias": 7},
        "resumo": {
          "receitaPaga": 800,
          "receitaAReceber": 240,
          "receitaTotal": 1040,
          "ticketMedio": 130,
          "horasVendidas": 8,
          "horasDisponiveis": 42,
          "vendidas": 8,
          "canceladas": 1,
        },
        "porDia": <dynamic>[],
        "porQuadra": <dynamic>[],
      });

      await repositorio.painel(arena, dias: 7);

      expect(adaptador.pedidos.single.queryParameters, {"dias": 7});
      expect(
        adaptador.pedidos.single.path,
        "/gestao/estabelecimentos/$arena/painel",
      );
    });

    test("a agenda manda a data", () async {
      adaptador.responde({"data": "2026-10-20", "itens": <dynamic>[]});

      await repositorio.agenda(arena, "2026-10-20");

      expect(adaptador.pedidos.single.queryParameters, {"data": "2026-10-20"});
    });
  });

  group("bloqueio de horário", () {
    test("manda o horário em UTC, como a reserva", () async {
      // Mesma razão do `criar` da reserva: hora local faria o bloqueio sair
      // no horário errado, sem erro nenhum — e aí um horário pago poderia
      // acabar bloqueado.
      adaptador.responde({
        "id": "b1",
        "status": "BLOQUEIO",
        "ehBloqueio": true,
        "inicio": "2026-10-20T22:00:00.000Z",
        "fim": "2026-10-20T23:00:00.000Z",
        "horaInicio": "19:00",
        "horaFim": "20:00",
        "quadraId": "q1",
        "quadraNome": "Quadra 1",
      });

      await repositorio.criarBloqueio(
        arena,
        quadraId: "q1",
        inicio: DateTime.utc(2026, 10, 20, 22),
        fim: DateTime.utc(2026, 10, 20, 23),
        motivo: "manutenção da rede",
      );

      final corpo = adaptador.pedidos.single.data as Map<String, dynamic>;
      expect(corpo["inicio"], "2026-10-20T22:00:00.000Z");
      expect(corpo["fim"], endsWith("Z"));
      expect(corpo["motivo"], "manutenção da rede");
    });

    test("motivo ausente ou vazio não vai no corpo", () async {
      // O `prompt` da web devolve "" no OK sem digitar, e o app passa adiante.
      // Mandar `motivo: ""` gravaria um bloqueio com motivo em branco, que no
      // relatório fica indistinguível de dado faltando.
      final resposta = {
        "id": "b1",
        "status": "BLOQUEIO",
        "ehBloqueio": true,
        "inicio": "2026-10-20T22:00:00.000Z",
        "fim": "2026-10-20T23:00:00.000Z",
        "horaInicio": "19:00",
        "horaFim": "20:00",
        "quadraId": "q1",
        "quadraNome": "Q",
      };

      adaptador.responde(resposta);
      await repositorio.criarBloqueio(
        arena,
        quadraId: "q1",
        inicio: DateTime.utc(2026, 10, 20, 22),
        fim: DateTime.utc(2026, 10, 20, 23),
      );
      expect(
        (adaptador.pedidos.last.data as Map).containsKey("motivo"),
        isFalse,
      );

      adaptador.responde(resposta);
      await repositorio.criarBloqueio(
        arena,
        quadraId: "q1",
        inicio: DateTime.utc(2026, 10, 20, 22),
        fim: DateTime.utc(2026, 10, 20, 23),
        motivo: "",
      );
      expect(
        (adaptador.pedidos.last.data as Map).containsKey("motivo"),
        isFalse,
      );
    });

    test("remover bloqueio usa DELETE na rota do bloqueio", () async {
      adaptador.responde(<String, dynamic>{});

      await repositorio.removerBloqueio(arena, "b1");

      expect(adaptador.pedidos.single.method, "DELETE");
      expect(
        adaptador.pedidos.single.path,
        "/gestao/estabelecimentos/$arena/bloqueios/b1",
      );
    });

    test("409 ao bloquear horário pago chega com status e mensagem", () async {
      // A restrição de exclusão do banco impede bloquear sobre reserva ativa,
      // e é o 409 que permite à tela explicar em vez de só falhar.
      adaptador.falha(
        status: 409,
        corpo: {"message": "Há reserva ativa neste horário."},
      );

      await expectLater(
        repositorio.criarBloqueio(
          arena,
          quadraId: "q1",
          inicio: DateTime.utc(2026, 10, 20, 22),
          fim: DateTime.utc(2026, 10, 20, 23),
        ),
        throwsA(
          isA<ApiException>().having((e) => e.status, "status", 409).having(
                (e) => e.mensagem,
                "mensagem",
                "Há reserva ativa neste horário.",
              ),
        ),
      );
    });
  });

  group("desserialização do estabelecimento", () {
    test("plano e ativo têm padrão, quadras conta zero", () async {
      adaptador.responde([
        {"id": arena, "nome": "Arena"},
      ]);

      final e = (await repositorio.meusEstabelecimentos()).single;

      expect(e.plano, "FREE");
      expect(e.ativo, isTrue, reason: "sem o campo, a arena não está pausada");
      expect(e.quadras, 0);
      expect(e.cidade, isNull);
    });

    test("lista vazia não é erro", () async {
      adaptador.responde(<dynamic>[]);
      expect(await repositorio.meusEstabelecimentos(), isEmpty);
    });

    test("corpo nulo devolve lista vazia", () async {
      adaptador.responde(null);
      expect(await repositorio.equipe(arena), isEmpty);
    });
  });
}
