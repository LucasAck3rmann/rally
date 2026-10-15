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

    test("papel desconhecido cai no menos poderoso, e não no mais", () {
      // Um papel novo na API chegando como `admin` abriria escrita para quem
      // o servidor recusaria; como `atendente`, no pior caso esconde botão.
      expect(PapelGestao.doTexto("PAPEL_QUE_AINDA_NAO_EXISTE"),
          PapelGestao.atendente);
    });

    test("ida e volta preserva o papel", () {
      for (final papel in PapelGestao.values) {
        expect(PapelGestao.doTexto(papel.paraApi), papel);
      }
    });
  });
}
