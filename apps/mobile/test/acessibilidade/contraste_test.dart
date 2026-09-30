// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "dart:math" as math;

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/core/theme/app_colors.dart";

/// **Contraste das cores do produto (RNF-08 · WCAG 2.2 AA).**
///
/// A matriz de rastreabilidade dizia "contraste resolvido no design system"
/// — uma afirmação, não uma medida. Medido, o design system reprovava em
/// quatro pares que o produto usa todo dia.
///
/// O que este arquivo testa **não é a paleta**, e sim os **pares que existem
/// na interface**: uma cor só é aprovada ou reprovada contra o fundo sobre o
/// qual ela é de fato desenhada. Par novo na interface entra nesta lista —
/// é o único jeito de a lista continuar dizendo a verdade.
void main() {
  group("texto — mínimo 4,5:1 (WCAG 1.4.3, AA)", () {
    for (final par in _paresDeTexto) {
      test(par.uso, () {
        expect(
          _contraste(par.frente, par.fundo),
          greaterThanOrEqualTo(4.5),
          reason: "${par.uso}: ${_hex(par.frente)} sobre ${_hex(par.fundo)}",
        );
      });
    }
  });

  group("componentes e ícones — mínimo 3:1 (WCAG 1.4.11, AA)", () {
    for (final par in _paresDeComponente) {
      test(par.uso, () {
        expect(
          _contraste(par.frente, par.fundo),
          greaterThanOrEqualTo(3.0),
          reason: "${par.uso}: ${_hex(par.frente)} sobre ${_hex(par.fundo)}",
        );
      });
    }
  });

  test("o cálculo confere com os extremos conhecidos", () {
    // Sem esta âncora, um erro na fórmula aprovaria a paleta inteira em
    // silêncio — e o teste passaria a provar nada.
    expect(_contraste(Colors.black, Colors.white), closeTo(21, 0.01));
    expect(_contraste(Colors.white, Colors.white), closeTo(1, 0.01));
  });
}

typedef _Par = ({Color frente, Color fundo, String uso});

/// Pares em que a cor da frente é **texto**.
const _paresDeTexto = <_Par>[
  (
    frente: AppColors.ink,
    fundo: AppColors.white,
    uso: "corpo sobre card branco",
  ),
  (
    frente: AppColors.ink,
    fundo: AppColors.bg,
    uso: "corpo sobre o fundo da página",
  ),
  (
    frente: AppColors.ink,
    fundo: AppColors.sand,
    uso: "selo NA VITRINE e pílula de passo",
  ),
  (
    frente: AppColors.ink,
    fundo: AppColors.coral,
    uso: "rótulo do botão primário",
  ),
  (
    frente: AppColors.ink,
    fundo: AppColors.sun,
    uso: "selo da promoção na Home",
  ),
  (
    frente: AppColors.gray,
    fundo: AppColors.white,
    uso: "texto secundário em card",
  ),
  (
    frente: AppColors.gray,
    fundo: AppColors.bg,
    uso: "texto secundário sobre o fundo da página",
  ),
  (
    frente: AppColors.gray,
    fundo: AppColors.sand,
    uso: "rótulo mono sobre areia",
  ),
  (
    frente: AppColors.coralDeep,
    fundo: AppColors.white,
    uso: "link e ação em card (Ver todas, Tentar de novo)",
  ),
  (
    frente: AppColors.coralDeep,
    fundo: AppColors.bg,
    uso: "ação sobre o fundo da página",
  ),
  (
    frente: AppColors.coralDeep,
    fundo: AppColors.coralSoft,
    uso: "selo PAUSADA e CANCELADA",
  ),
  (
    frente: AppColors.white,
    fundo: AppColors.ink,
    uso: "título do splash e do SnackBar",
  ),
  (
    frente: AppColors.sand,
    fundo: AppColors.ink,
    uso: "subtítulo do splash",
  ),
  (
    frente: AppColors.sun,
    fundo: AppColors.ink,
    uso: "faixa marquee e ação do SnackBar",
  ),
  (
    frente: AppColors.onInkMuted,
    fundo: AppColors.ink,
    uso: "texto de apoio em card escuro",
  ),
];

/// Pares em que a cor da frente é um **ícone ou limite de componente**.
///
/// Fora desta lista, de propósito: o **ícone da aba ativa** em `coral` sobre
/// branco dá 2,82. Ele fica, porque o estado ativo não depende da cor — o
/// rótulo muda de `gray` para `ink` **e** de peso junto com o ícone, e a
/// 1.4.11 não se aplica quando a informação chega por outro caminho.
/// Escurecer o coral ali resolveria o número e apagaria a marca; a decisão
/// é do dono do produto, não deste teste.
const _paresDeComponente = <_Par>[
  (
    frente: AppColors.gray,
    fundo: AppColors.white,
    uso: "ícone da aba inativa",
  ),
  (
    frente: AppColors.ink,
    fundo: AppColors.white,
    uso: "ícone de ação em card",
  ),
  (
    frente: AppColors.coralDeep,
    fundo: AppColors.white,
    uso: "ícone destrutivo e de ação",
  ),
  (
    frente: AppColors.coralDeep,
    fundo: AppColors.coralSoft,
    uso: "ícone sobre o fundo destrutivo",
  ),
];

/// Razão de contraste da WCAG 2.2: `(L1 + 0,05) / (L2 + 0,05)`.
double _contraste(Color a, Color b) {
  final la = _luminancia(a);
  final lb = _luminancia(b);
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// Luminância relativa, pela definição da WCAG — que **não** é a mesma coisa
/// que o brilho percebido nem que o `computeLuminance` de qualquer paleta.
double _luminancia(Color cor) {
  double canal(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * canal(cor.r) + 0.7152 * canal(cor.g) + 0.0722 * canal(cor.b);
}

String _hex(Color cor) {
  final v = cor.toARGB32() & 0xFFFFFF;
  return "#${v.toRadixString(16).padLeft(6, "0").toUpperCase()}";
}
