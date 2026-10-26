// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// **O domínio da gestão na borda do JSON, que estava em 66,3%.**
///
/// O `papel_gestao_test.dart` ao lado cobre o enum de papel, que é a parte com
/// consequência de segurança. O que faltava é a outra metade do arquivo: as
/// fábricas que transformam a resposta da API em objeto, e os **padrões** que
/// elas aplicam quando um campo não vem.
///
/// Padrão escolhido errado aqui não estoura: ele mente baixinho. Uma arena que
/// chega sem `ativo` virando `false` a tiraria do seletor; `quadras` sem valor
/// virando `null` quebraria a contagem da barra lateral. Cada `??` deste
/// arquivo é uma decisão, e nenhuma era exercitada.
library;

import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";

Map<String, dynamic> arena({Map<String, dynamic> trocas = const {}}) => {
      "id": "e1",
      "nome": "Arena Sapiranga",
      "plano": "PRO",
      "ativo": true,
      "quadras": 6,
      "meuPapel": "ADMIN",
      "cidade": "Sapiranga",
      "uf": "RS",
      ...trocas,
    };

Map<String, dynamic> faixa({Map<String, dynamic> trocas = const {}}) => {
      "id": "f1",
      "diaSemana": 2,
      "horaInicio": "19:00",
      "horaFim": "22:00",
      "precoHora": 120,
      ...trocas,
    };

void main() {
  group("EstabelecimentoGerido.doJson", () {
    test("lê a arena completa", () {
      final e = EstabelecimentoGerido.doJson(arena());

      expect(e.id, "e1");
      expect(e.nome, "Arena Sapiranga");
      expect(e.plano, "PRO");
      expect(e.ativo, isTrue);
      expect(e.quadras, 6);
      expect(e.meuPapel, PapelGestao.admin);
    });

    test("sem plano, FREE; sem `ativo`, ativa; sem quadras, zero", () {
      // Os três padrões são **otimistas de propósito**, e cada um por um
      // motivo diferente: plano ausente é o plano mais restrito, de modo que
      // errar não libera recurso pago; `ativo: false` por omissão tiraria a
      // arena do seletor e a pessoa não acharia o próprio painel; e `quadras`
      // alimenta uma contagem, onde zero é a resposta honesta para "não sei".
      final e = EstabelecimentoGerido.doJson(
        arena()
          ..remove("plano")
          ..remove("ativo")
          ..remove("quadras"),
      );

      expect(e.plano, "FREE");
      expect(e.ativo, isTrue);
      expect(e.quadras, 0);
    });

    test("papel ausente não vira atendente", () {
      // O `?? ""` cai no `doTexto`, que não reconhece a cadeia vazia e
      // devolve `desconhecido`. É a correção do #104 valendo também para o
      // campo **ausente**, e não só para o valor novo: um papel que o app não
      // leu nunca deve parecer um papel que ele leu.
      final e = EstabelecimentoGerido.doJson(arena()..remove("meuPapel"));

      expect(e.meuPapel, PapelGestao.desconhecido);
      expect(e.meuPapel.rotulo, "Papel indisponível");
    });

    test("a contagem de quadras aceita número fracionário da API", () {
      // `as num` e não `as int`: JSON não distingue os dois, e um `6.0` vindo
      // de um `_count` do Prisma estouraria num `as int`.
      expect(
          EstabelecimentoGerido.doJson(arena(trocas: {"quadras": 6.0})).quadras,
          6);
    });

    test("a localização junta cidade e UF, e omite o que falta", () {
      expect(
          EstabelecimentoGerido.doJson(arena()).localizacao, "Sapiranga · RS");
      // Sem UF, só a cidade — e **sem o separador solto**, que é o ponto de
      // filtrar antes de juntar.
      expect(
        EstabelecimentoGerido.doJson(arena(trocas: {"uf": null})).localizacao,
        "Sapiranga",
      );
      // Cadeia vazia conta como ausente, e não como parte a exibir: a API
      // manda `""` em cadastro incompleto.
      expect(
        EstabelecimentoGerido.doJson(arena(trocas: {"cidade": "", "uf": "RS"}))
            .localizacao,
        "RS",
      );
      expect(
        EstabelecimentoGerido.doJson(
            arena(trocas: {"cidade": null, "uf": null})).localizacao,
        "",
      );
    });
  });

  group("FaixaPreco.doJson", () {
    test("lê a faixa de um dia", () {
      final f = FaixaPreco.doJson(faixa());

      expect(f.id, "f1");
      expect(f.diaSemana, 2);
      expect(f.horaInicio, "19:00");
      expect(f.precoHora, 120.0);
    });

    test("`diaSemana` nulo é a semana inteira, e não um estouro", () {
      // É o **caso mais comum**, e era onde a leitura como `num` estourava:
      // a API manda `null` quando a faixa vale para todos os dias.
      final f = FaixaPreco.doJson(faixa(trocas: {"diaSemana": null}));

      expect(f.diaSemana, isNull);
      expect(f.diaRotulo, "Todos os dias");
    });

    test("faixa recém-composta na tela não tem id", () {
      // `null` no `id` distingue a faixa que o usuário acabou de adicionar da
      // que já existe no banco — e é o que o `paraJson` usa para não mandar
      // um id inventado.
      final f = FaixaPreco.doJson(faixa()..remove("id"));

      expect(f.id, isNull);
    });

    test("o preço inteiro da API chega como decimal", () {
      // `120` no JSON é `int`; o campo é `double`. Sem o `.toDouble()` a
      // leitura estoura, e o preço é o que a tela multiplica pela duração.
      expect(FaixaPreco.doJson(faixa(trocas: {"precoHora": 120})).precoHora,
          120.0);
      expect(FaixaPreco.doJson(faixa(trocas: {"precoHora": 99.9})).precoHora,
          99.9);
    });

    test("o que vai para a API não leva o id", () {
      // O `id` é do banco, não do contrato: o `FaixaPrecoDto` não o declara, e
      // o `whitelist` do `ValidationPipe` o descartaria — mas mandá-lo
      // sugeriria que o cliente escolhe o identificador.
      expect(FaixaPreco.doJson(faixa()).paraJson(), {
        "diaSemana": 2,
        "horaInicio": "19:00",
        "horaFim": "22:00",
        "precoHora": 120.0,
      });
    });
  });

  group("FaixaPreco.copiarCom", () {
    test("trocar a hora preserva o resto", () {
      final f = FaixaPreco.doJson(faixa()).copiarCom(horaInicio: "18:00");

      expect(f.horaInicio, "18:00");
      expect(f.horaFim, "22:00");
      expect(f.diaSemana, 2);
      expect(f.precoHora, 120.0);
    });

    test("não informar o dia preserva o dia, e informar `null` o apaga", () {
      // **A razão da sentinela `_naoInformado`.** Com `int?` puro, "não mexi"
      // e "quero todos os dias" chegariam os dois como `null`, e trocar a hora
      // de uma faixa de terça a transformaria numa faixa da semana inteira —
      // mudando o preço de seis dias que ninguém pediu para mudar.
      final terca = FaixaPreco.doJson(faixa());

      expect(terca.copiarCom(precoHora: 150).diaSemana, 2);
      expect(terca.copiarCom(diaSemana: null).diaSemana, isNull);
    });
  });

  group("o rótulo do dia", () {
    test("cada dia que a API nomeia tem o seu", () {
      expect(FaixaPreco.rotuloDoDia(null), "Todos os dias");
      expect(FaixaPreco.rotuloDoDia(0), "Domingo");
      expect(FaixaPreco.rotuloDoDia(1), "Segunda");
      expect(FaixaPreco.rotuloDoDia(2), "Terça");
      expect(FaixaPreco.rotuloDoDia(3), "Quarta");
      expect(FaixaPreco.rotuloDoDia(4), "Quinta");
      expect(FaixaPreco.rotuloDoDia(5), "Sexta");
      expect(FaixaPreco.rotuloDoDia(6), "Sábado");
    });

    test("a lista oferecida é a semana inteira mais os sete dias", () {
      // A lista mora no domínio porque o menu do formulário tinha a mesma
      // escrita à mão. Oito itens, sem repetição, e com rótulo distinto cada
      // um — rótulo repetido faria dois itens idênticos no menu.
      expect(FaixaPreco.diasOferecidos, hasLength(8));
      expect(FaixaPreco.diasOferecidos.toSet(), hasLength(8));

      final rotulos = FaixaPreco.diasOferecidos.map(FaixaPreco.rotuloDoDia);
      expect(rotulos.toSet(), hasLength(8));
    });

    test("domingo é 0, e não 7 — a convenção é a da API", () {
      // O engano fácil: `DateTime.weekday` do Dart vai de 1 (segunda) a 7
      // (domingo), e as duas convenções **concordam de segunda a sexta**. Só
      // divergem no domingo, de modo que trocá-las passa por qualquer teste
      // que não olhe justamente esse dia.
      expect(FaixaPreco.rotuloDoDia(0), "Domingo");
      expect(FaixaPreco.rotuloDoDia(DateTime.sunday), isNot("Domingo"));
    });
  });

  group("DadosQuadra.daQuadra", () {
    test("o formulário nasce com o que a quadra tem", () {
      final q = QuadraGestao.doJson({
        "id": "q1",
        "nome": "Quadra 1",
        "precoHora": 100,
        "ativo": true,
        "modalidades": ["BEACH_TENNIS"],
        "fotos": ["f.png"],
        "comodidades": ["Vestiário"],
        "capacidade": 4,
        "descricao": "Coberta",
      });

      final dados = DadosQuadra.daQuadra(q);

      expect(dados.nome, "Quadra 1");
      expect(dados.precoHora, 100.0);
      expect(dados.modalidades, ["BEACH_TENNIS"]);
      expect(dados.descricao, "Coberta");
      expect(dados.capacidade, 4);
    });

    test("listas ausentes viram listas vazias, e não nulo", () {
      // A tela percorre as três. `null` ali quebraria a edição de uma quadra
      // que simplesmente ainda não tem foto nem comodidade cadastrada.
      final q = QuadraGestao.doJson({
        "id": "q1",
        "nome": "Quadra 1",
        "precoHora": 100,
      });

      expect(q.modalidades, isEmpty);
      expect(q.fotos, isEmpty);
      expect(q.comodidades, isEmpty);
      expect(q.ativo, isTrue);
    });
  });
}
