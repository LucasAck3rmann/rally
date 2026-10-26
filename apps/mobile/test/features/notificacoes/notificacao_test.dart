// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// **O domínio das notificações, que estava em 16,7%.**
///
/// Um arquivo de domínio nessa medida é o pior tipo de lacuna: domínio é onde
/// moram as decisões, e aqui havia três sem nenhuma execução — a conversão do
/// tipo que a API manda, o ícone de cada tipo, e os padrões do JSON.
///
/// A primeira é a que mais pesa. O enum ganhou o membro `desconhecido` para
/// que tipo novo da API não caísse pelo `_` no `lembrete`, com o sino e a cor
/// dele; é a mesma correção do `#104` que o [PapelGestao] e os dois status de
/// reserva receberam. **A correção estava escrita e nada a exercitava** — e a
/// Matriz dava a classe de defeito como fechada.
///
/// O portão `enums_espelham_a_api_test.dart` cobre a outra ponta: que todo
/// valor que a API nomeia seja reconhecido. Aqui o assunto é o contrário —
/// o que o app faz com o que **não** reconhece, e o que ele faz com um JSON
/// incompleto.
library;

import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/features/notificacoes/domain/notificacao.dart";

/// Um aviso completo, do jeito que a API o manda.
Map<String, dynamic> aviso({Map<String, dynamic> trocas = const {}}) => {
      "id": "n1",
      "tipo": "RESERVA",
      "titulo": "Reserva confirmada",
      "corpo": "Quadra 1, terça às 19h.",
      "lida": false,
      "criadaEm": "2026-10-26T12:00:00.000Z",
      ...trocas,
    };

void main() {
  group("NotificacaoTipo.doTexto", () {
    test("converte os cinco que a API nomeia", () {
      expect(NotificacaoTipo.doTexto("RESERVA"), NotificacaoTipo.reserva);
      expect(NotificacaoTipo.doTexto("PAGAMENTO"), NotificacaoTipo.pagamento);
      expect(NotificacaoTipo.doTexto("REPLAY"), NotificacaoTipo.replay);
      expect(NotificacaoTipo.doTexto("PROMOCAO"), NotificacaoTipo.promocao);
      expect(NotificacaoTipo.doTexto("LEMBRETE"), NotificacaoTipo.lembrete);
    });

    test("tipo desconhecido vira `desconhecido`, e não `lembrete`", () {
      // **A correção do #104 vista por dentro.** Antes do membro
      // `desconhecido`, o `_` levava ao `lembrete`: qualquer tipo novo da API
      // aparecia com o sino e a cor de lembrete, afirmando uma categoria que
      // o app não tinha lido.
      expect(NotificacaoTipo.doTexto("TORNEIO"), NotificacaoTipo.desconhecido);
      expect(NotificacaoTipo.doTexto(""), NotificacaoTipo.desconhecido);
      // Sensível a caixa, como a API manda: `reserva` minúsculo não é
      // `RESERVA`, e tratá-lo como se fosse esconderia um desalinho real.
      expect(NotificacaoTipo.doTexto("reserva"), NotificacaoTipo.desconhecido);
    });
  });

  group("o ícone de cada tipo", () {
    test("cada tipo conhecido tem o seu", () {
      expect(NotificacaoTipo.reserva.icone, "calendario");
      expect(NotificacaoTipo.pagamento.icone, "pagamentos");
      expect(NotificacaoTipo.replay.icone, "play-circulo");
      expect(NotificacaoTipo.promocao.icone, "estrela");
      expect(NotificacaoTipo.lembrete.icone, "sino");
    });

    test("o desconhecido ganha o sino, e não a ausência de ícone", () {
      // O aviso existe e deve aparecer; só não se sabe de que tipo é.
      // Esconder a notificação seria pior que mostrá-la sem categoria — e
      // devolver vazio aqui faria a tela desenhar um buraco.
      expect(NotificacaoTipo.desconhecido.icone, "sino");
    });
  });

  group("Notificacao.doJson", () {
    test("lê o aviso completo", () {
      final n = Notificacao.doJson(aviso(trocas: {"destino": "/reservas/r1"}));

      expect(n.id, "n1");
      expect(n.tipo, NotificacaoTipo.reserva);
      expect(n.titulo, "Reserva confirmada");
      expect(n.corpo, "Quadra 1, terça às 19h.");
      expect(n.lida, isFalse);
      expect(n.destino, "/reservas/r1");
    });

    test("a data vem em UTC e é guardada no fuso do aparelho", () {
      // `.toLocal()` é a decisão: sem ela, um aviso criado às 12h UTC
      // apareceria como 12h para quem está em São Paulo, onde eram 9h. O
      // teste afirma o instante, que é o mesmo nos dois fusos, **e** que o
      // objeto não é UTC — é o que a `.toLocal()` faz.
      final n = Notificacao.doJson(aviso());

      expect(n.criadaEm.isUtc, isFalse);
      expect(
        n.criadaEm.toUtc(),
        DateTime.utc(2026, 10, 26, 12),
      );
    });

    test("sem `lida`, o aviso é tratado como não lido", () {
      // O padrão seguro: mostrar o selo de não lido num aviso já lido é
      // ruído, e esconder um aviso novo é perda. Na dúvida, aparece.
      final json = aviso()..remove("lida");

      expect(Notificacao.doJson(json).lida, isFalse);
    });

    test("sem `destino`, o toque não leva a lugar nenhum", () {
      // `null` e não string vazia: a tela decide se o item é tocável por
      // `destino != null`, e `""` passaria por essa decisão e navegaria para
      // a rota vazia.
      expect(Notificacao.doJson(aviso()).destino, isNull);
    });
  });

  group("CaixaDeAvisos.doJson", () {
    test("lê a contagem e a lista", () {
      final caixa = CaixaDeAvisos.doJson({
        "naoLidas": 2,
        "itens": [
          aviso(),
          aviso(trocas: {"id": "n2", "tipo": "PAGAMENTO"})
        ],
      });

      expect(caixa.naoLidas, 2);
      expect(caixa.itens, hasLength(2));
      expect(caixa.itens[1].tipo, NotificacaoTipo.pagamento);
    });

    test("a contagem aceita número fracionário da API sem estourar", () {
      // `as num` e não `as int`: JSON não distingue os dois, e um `2.0`
      // vindo de um agregado do banco estouraria num `as int`. O selo do
      // menu lê este número.
      expect(CaixaDeAvisos.doJson({"naoLidas": 2.0, "itens": []}).naoLidas, 2);
    });

    test("caixa vazia é lista vazia, e não erro", () {
      // Resposta sem `itens` acontece em conta nova. Estourar aqui deixaria
      // a tela de avisos em branco com erro, em vez de dizer "nada por
      // aqui".
      final caixa = CaixaDeAvisos.doJson(const {});

      expect(caixa.naoLidas, 0);
      expect(caixa.itens, isEmpty);
    });
  });
}
