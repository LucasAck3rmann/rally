// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/core/network/erro_api.dart";
import "package:rally_mobile/features/reservas/data/reservas_repository_impl.dart";
import "package:rally_mobile/features/reservas/domain/reserva.dart";

import "../../fakes/adaptador_falso.dart";

/// **O caminho crítico do cliente, que estava sem cobertura.**
///
/// É por aqui que a reserva nasce, é paga, remarcada e cancelada — e estava em
/// 0%, como todos os repositórios. O que mais importa nesta suíte não é a
/// desserialização: é **o que o aplicativo envia**. Uma reserva criada com a
/// hora no fuso errado sai confirmada, sem erro nenhum, no horário errado — o
/// mesmo tipo de defeito do `"25:00"` que a web tinha em 13/10, em que os
/// tipos combinavam e o significado não.
void main() {
  late AdaptadorFalso adaptador;
  late ReservasRepositoryImpl repositorio;

  setUp(() {
    adaptador = AdaptadorFalso();
    repositorio = ReservasRepositoryImpl(dioFalso(adaptador));
  });

  Map<String, dynamic> reservaJson({Map<String, dynamic> extras = const {}}) {
    return {
      "id": "r1",
      "codigo": "RLY-4821",
      "inicio": "2026-10-20T22:00:00.000Z",
      "fim": "2026-10-20T23:00:00.000Z",
      "horaInicio": "19:00",
      "horaFim": "20:00",
      "status": "CONFIRMADA",
      "preco": 90,
      "cancelavel": true,
      "cancelamentoGratuito": true,
      "cancelamentoHoras": 12,
      "quadra": {
        "id": "q1",
        "nome": "Quadra 1",
        "modalidades": ["Beach Tennis"],
        "fotos": ["https://exemplo/1.jpg"],
        "estabelecimento": {"id": "e1", "nome": "Arena Beira-Rio"},
      },
      ...extras,
    };
  }

  group("criar — o que o aplicativo envia", () {
    test("manda o horário em UTC, e não no fuso do aparelho", () async {
      // **A asserção mais importante do arquivo.** O servidor revalida o
      // horário, mas contra o instante que recebeu: mandar hora local faria a
      // reserva sair confirmada no horário errado, sem erro algum. Com o
      // aparelho em UTC-3, 19h local são 22h UTC.
      adaptador.responde(reservaJson());
      final inicio = DateTime.utc(2026, 10, 20, 22).toLocal();

      await repositorio.criar(
        quadraId: "q1",
        inicio: inicio,
        fim: inicio.add(const Duration(hours: 1)),
        metodo: "PIX",
      );

      final corpo = adaptador.pedidos.single.data as Map<String, dynamic>;
      expect(corpo["inicio"], "2026-10-20T22:00:00.000Z");
      expect(corpo["fim"], "2026-10-20T23:00:00.000Z");
      // Termina em Z: é o que prova que a conversão aconteceu.
      expect(corpo["inicio"], endsWith("Z"));
    });

    test("manda quadra e método, e nada além do contrato", () async {
      adaptador.responde(reservaJson());

      await repositorio.criar(
        quadraId: "q7",
        inicio: DateTime.utc(2026, 10, 20, 22),
        fim: DateTime.utc(2026, 10, 20, 23),
        metodo: "PIX",
      );

      final pedido = adaptador.pedidos.single;
      expect(pedido.path, "/reservas");
      expect(pedido.method, "POST");
      expect(pedido.data, {
        "quadraId": "q7",
        "inicio": "2026-10-20T22:00:00.000Z",
        "fim": "2026-10-20T23:00:00.000Z",
        "metodo": "PIX",
      });
      // Nada de preço: o servidor recalcula, e mandar o valor daria a
      // impressão de que o cliente o escolhe.
      expect((pedido.data as Map).containsKey("preco"), isFalse);
    });

    test("409 de horário tomado chega com a mensagem e o status", () async {
      // É o caso que a restrição de exclusão do banco produz, e a tela precisa
      // do 409 para oferecer outro horário em vez de só mostrar o texto.
      adaptador.falha(
        status: 409,
        corpo: {"message": "Este horário acabou de ser reservado."},
      );

      await expectLater(
        repositorio.criar(
          quadraId: "q1",
          inicio: DateTime.utc(2026, 10, 20, 22),
          fim: DateTime.utc(2026, 10, 20, 23),
          metodo: "PIX",
        ),
        throwsA(
          isA<ApiException>().having((e) => e.status, "status", 409).having(
                (e) => e.mensagem,
                "mensagem",
                "Este horário acabou de ser reservado.",
              ),
        ),
      );
    });
  });

  group("remarcar e cancelar", () {
    test("remarcar manda só os horários, em UTC", () async {
      adaptador.responde(reservaJson());

      await repositorio.remarcar(
        "r1",
        inicio: DateTime.utc(2026, 10, 21, 22),
        fim: DateTime.utc(2026, 10, 21, 23),
      );

      expect(adaptador.pedidos.single.path, "/reservas/r1/remarcar");
      expect(adaptador.pedidos.single.data, {
        "inicio": "2026-10-21T22:00:00.000Z",
        "fim": "2026-10-21T23:00:00.000Z",
      });
    });

    test("cancelar sem motivo não manda a chave", () async {
      // Mandar `motivo: null` faria o validador da API recusar o corpo, e a
      // pessoa veria um erro de validação ao cancelar sem escrever nada.
      adaptador.responde(reservaJson(extras: {"dentroDoPrazo": true}));

      await repositorio.cancelar("r1");

      expect(adaptador.pedidos.single.data, isEmpty);
    });

    test("cancelar com motivo manda o motivo", () async {
      adaptador.responde(reservaJson(extras: {"dentroDoPrazo": true}));

      await repositorio.cancelar("r1", motivo: "chuva");

      expect(adaptador.pedidos.single.data, {"motivo": "chuva"});
    });

    test("o cancelamento lê `dentroDoPrazo` do mesmo corpo da reserva",
        () async {
      // Contrato sutil: a resposta do cancelamento traz os campos da reserva
      // **e** o `dentroDoPrazo` no mesmo nível. É esse booleano que decide se
      // a tela diz que o cancelamento foi gratuito.
      adaptador.responde(reservaJson(extras: {"dentroDoPrazo": true}));

      final resultado = await repositorio.cancelar("r1");

      expect(resultado.dentroDoPrazo, isTrue);
      expect(resultado.reserva.codigo, "RLY-4821");
    });

    test("sem `dentroDoPrazo`, assume fora do prazo", () async {
      // O padrão é o conservador: dizer "foi gratuito" quando não se sabe
      // prometeria ao cliente um estorno que a arena não vai fazer.
      adaptador.responde(reservaJson());

      expect((await repositorio.cancelar("r1")).dentroDoPrazo, isFalse);
    });
  });

  group("desserialização", () {
    test("lê a quadra e o estabelecimento aninhados", () async {
      adaptador.responde([reservaJson()]);

      final r = (await repositorio.minhas()).single;

      expect(r.quadraNome, "Quadra 1");
      expect(r.estabelecimentoNome, "Arena Beira-Rio");
      expect(r.modalidades, ["Beach Tennis"]);
      expect(r.horaInicio, "19:00");
      // O rótulo vem pronto da API, no fuso da arena; o `DateTime` é local.
      expect(r.inicio.isUtc, isFalse);
    });

    test("o pagamento é opcional e vem aninhado", () async {
      adaptador.responde([
        reservaJson(
          extras: {
            "status": "PENDENTE_PAGAMENTO",
            "pagamento": {
              "id": "p1",
              "valor": 85.5,
              "metodo": "PIX",
              "status": "PENDENTE",
              "pixCopiaCola": "00020126...",
              "expiraEm": "2026-10-20T22:30:00.000Z",
            },
          },
        ),
      ]);

      final r = (await repositorio.minhas()).single;

      expect(r.pagamento, isNotNull);
      expect(r.pagamento!.valor, 85.5);
      expect(r.pagamento!.status, PagamentoStatus.pendente);
      expect(r.pagamento!.expiraEm!.isUtc, isFalse);
      // O valor do pagamento pode ser menor que o preço — é o desconto do
      // Pix da RN-03, e tratá-los como o mesmo número apagaria o desconto.
      expect(r.pagamento!.valor, lessThan(r.preco));
    });

    test("reserva sem pagamento não inventa um", () async {
      adaptador.responde([reservaJson()]);
      expect((await repositorio.minhas()).single.pagamento, isNull);
    });

    test("os quatro booleanos de cancelamento têm padrão conservador",
        () async {
      adaptador.responde([
        {
          "id": "r2",
          "codigo": "RLY-0001",
          "inicio": "2026-10-20T22:00:00.000Z",
          "fim": "2026-10-20T23:00:00.000Z",
          "horaInicio": "19:00",
          "horaFim": "20:00",
          "status": "CONFIRMADA",
          "preco": 90,
          "quadra": {
            "id": "q1",
            "nome": "Q",
            "estabelecimento": {"nome": "A"},
          },
        },
      ]);

      final r = (await repositorio.minhas()).single;

      // Sem o campo, não se oferece o botão: prometer cancelamento que a API
      // vai recusar é pior que não oferecer.
      expect(r.cancelavel, isFalse);
      expect(r.cancelamentoGratuito, isFalse);
      expect(r.cancelamentoHoras, 0);
      expect(r.canceladaEm, isNull);
    });

    test("canceladaEm vira hora local quando existe", () async {
      adaptador.responde([
        reservaJson(
          extras: {
            "status": "CANCELADA",
            "canceladaEm": "2026-10-19T14:00:00.000Z",
          },
        ),
      ]);

      final r = (await repositorio.minhas()).single;
      expect(r.canceladaEm, isNotNull);
      expect(r.canceladaEm!.isUtc, isFalse);
      expect(r.status, ReservaStatus.cancelada);
    });
  });

  group("status desconhecido — um risco que vale ficar registrado", () {
    test("cada status do contrato vira o seu", () async {
      for (final par in {
        "PENDENTE_PAGAMENTO": ReservaStatus.pendentePagamento,
        "CONFIRMADA": ReservaStatus.confirmada,
        "CANCELADA": ReservaStatus.cancelada,
        "CONCLUIDA": ReservaStatus.concluida,
        "NO_SHOW": ReservaStatus.noShow,
      }.entries) {
        adaptador.responde([
          reservaJson(extras: {"status": par.key})
        ]);
        expect(
          (await repositorio.minhas()).single.status,
          par.value,
          reason: par.key,
        );
      }
    });

    test("status novo da API cai em `bloqueio` e é exibido como Bloqueada",
        () async {
      // ⚠️ **Este teste documenta um risco, não aprova o comportamento.**
      //
      // O `doTexto` usa `_ => ReservaStatus.bloqueio` como padrão. Se a API
      // ganhar um status novo — e o RF-15, estorno pelo painel, está previsto
      // —, o aplicativo mostrará **"Bloqueada"** para uma reserva que é outra
      // coisa. Não é falha visível: é classificação errada em silêncio, com o
      // rótulo de um estado que significa o oposto para quem lê.
      //
      // O padrão seguro seria um valor `desconhecido` com rótulo neutro, e aí
      // o `switch` exaustivo do `rotulo` obrigaria a decidir o texto. A
      // mudança mexe no modelo de domínio e fica para um PR próprio; aqui o
      // comportamento atual fica **preso e declarado**, para que a mudança
      // seja deliberada e não acidental.
      adaptador.responde([
        reservaJson(extras: {"status": "REEMBOLSADA"})
      ]);

      final r = (await repositorio.minhas()).single;
      expect(r.status, ReservaStatus.bloqueio);
      expect(r.status.rotulo, "Bloqueada");
    });

    test("status de pagamento novo cai em `pendente`, com o mesmo risco",
        () async {
      // Aqui a consequência é mais direta: o aplicativo mostraria
      // "Aguardando pagamento" para uma cobrança que já foi resolvida.
      adaptador.responde([
        reservaJson(
          extras: {
            "pagamento": {
              "id": "p1",
              "valor": 90,
              "metodo": "PIX",
              "status": "EM_DISPUTA",
            },
          },
        ),
      ]);

      final r = (await repositorio.minhas()).single;
      expect(r.pagamento!.status, PagamentoStatus.pendente);
    });
  });

  group("simular pagamento", () {
    test("chama a rota de desenvolvimento", () async {
      adaptador.responde(<String, dynamic>{});

      await repositorio.simularPagamento("r1");

      expect(adaptador.pedidos.single.path, "/reservas/r1/simular-pagamento");
      expect(adaptador.pedidos.single.method, "POST");
    });

    test("fora de desenvolvimento, a recusa chega com a mensagem", () async {
      // A rota é bloqueada fora de desenvolvimento, e a mensagem da API é a
      // única pista de por que o botão não funcionou.
      adaptador.falha(
        status: 403,
        corpo: {"message": "Simulação indisponível neste ambiente."},
      );

      await expectLater(
        repositorio.simularPagamento("r1"),
        throwsA(
          isA<ApiException>().having(
            (e) => e.mensagem,
            "mensagem",
            "Simulação indisponível neste ambiente.",
          ),
        ),
      );
    });
  });
}
