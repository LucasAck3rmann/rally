// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/features/gestao/domain/gestao.dart";

void main() {
  group("PapelGestao.podeEditarQuadras", () {
    test("só o administrador da arena escreve", () {
      expect(PapelGestao.admin.podeEditarQuadras, isTrue);
    });

    test("mantenedor da plataforma não administra arena", () {
      // É o defeito que este teste fecha. O getter incluía `mantenedor`
      // contra o que o próprio comentário dele dizia: ele é papel de nível
      // SaaS, o `PAPEIS_DE_GESTAO` da API não o inclui, e o `PapelGuard` o
      // recusa em toda rota de arena. Quem caísse nesse papel veria os
      // botões e levaria 403 ao tocar.
      expect(PapelGestao.mantenedor.podeEditarQuadras, isFalse);
    });

    test("atendente e financeiro leem, mas não escrevem", () {
      expect(PapelGestao.atendente.podeEditarQuadras, isFalse);
      expect(PapelGestao.financeiro.podeEditarQuadras, isFalse);
    });

    test("exatamente um papel escreve, de todos os que existem", () {
      // Se um papel novo entrar no enum, este teste falha e obriga a decidir
      // de que lado ele cai — em vez de cair no `false` por omissão.
      final escrevem =
          PapelGestao.values.where((p) => p.podeEditarQuadras).toList();
      expect(escrevem, [PapelGestao.admin]);
    });
  });

  group("PapelGestao.doTexto", () {
    test("converte o que a API manda", () {
      expect(PapelGestao.doTexto("ADMIN"), PapelGestao.admin);
      expect(PapelGestao.doTexto("FINANCEIRO"), PapelGestao.financeiro);
      expect(PapelGestao.doTexto("MANTENEDOR"), PapelGestao.mantenedor);
      expect(PapelGestao.doTexto("ATENDENTE"), PapelGestao.atendente);
    });

    test("papel desconhecido vira `desconhecido`, e não `atendente`", () {
      // **Este teste afirmava o contrário, e o raciocínio dele estava certo
      // mas incompleto.** Ele dizia que cair em `atendente` era seguro,
      // porque um papel novo lido como `admin` abriria escrita que o
      // servidor recusaria, enquanto `atendente` no pior caso esconde botão.
      // Verdade — para *leitura*. O que faltava é que o papel **volta para a
      // API** em `paraApi`, no menu de troca: lido como `atendente` e
      // reenviado, ele **rebaixaria a pessoa de verdade**, gravando
      // `ATENDENTE` sobre o papel que o aplicativo não soube ler. Erro de
      // leitura virava escrita.
      //
      // `desconhecido` mantém a propriedade antiga — não escreve quadra,
      // como o teste de `podeEditarQuadras` cobra — e acrescenta a que
      // faltava: não pode ser enviado.
      expect(PapelGestao.doTexto("PAPEL_QUE_AINDA_NAO_EXISTE"),
          PapelGestao.desconhecido);
      expect(PapelGestao.desconhecido.podeEditarQuadras, isFalse);
    });

    test("`desconhecido` não pode ser enviado à API", () {
      // Falhar alto é o que impede o erro de leitura de se tornar escrita.
      // É inalcançável por construção, porque o menu só oferece
      // `atribuiveis` — e se algum caminho novo chegar aqui, quebra.
      expect(() => PapelGestao.desconhecido.paraApi, throwsStateError);
    });

    test("ida e volta preserva todo papel que a API nomeia", () {
      // `desconhecido` fica fora por não ser papel da API: ele é a ausência
      // de um, e não tem texto para onde voltar.
      final daApi =
          PapelGestao.values.where((p) => p != PapelGestao.desconhecido);
      expect(daApi, isNotEmpty);
      for (final papel in daApi) {
        expect(PapelGestao.doTexto(papel.paraApi), papel);
      }
    });

    test("os papéis oferecidos no menu são atribuíveis de verdade", () {
      // `mantenedor` fora porque o `PapelGuard` o recusa em rota de arena;
      // `desconhecido` fora porque não é papel. A lista mora no enum, e as
      // duas telas que a usam deixaram de ter cópia própria.
      expect(PapelGestao.atribuiveis, [
        PapelGestao.atendente,
        PapelGestao.financeiro,
        PapelGestao.admin,
      ]);
      expect(PapelGestao.atribuiveis, isNot(contains(PapelGestao.mantenedor)));
      expect(
          PapelGestao.atribuiveis, isNot(contains(PapelGestao.desconhecido)));
    });
  });
}
