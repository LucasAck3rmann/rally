import "package:flutter/material.dart";

/// Tokens de cor do design system Rally (ver DESIGN.md na raiz do repo).
abstract final class AppColors {
  static const coral = Color(0xFFFF6B4A);

  /// Escurecido de `#C2410C` em 30/09: sobre `coralSoft` o valor antigo
  /// dava 4,20 e o mínimo de texto é 4,5 (RNF-08).
  static const coralDeep = Color(0xFF9A3412);
  static const teal = Color(0xFF0FB5AE);
  static const sun = Color(0xFFFFC24B);
  static const sand = Color(0xFFF4E4CD);
  static const bg = Color(0xFFFFF7EE);
  static const ink = Color(0xFF1C2B33);

  /// Escurecido de `#6B7785` em 30/09: falhava sobre `bg` (4,30) e sobre
  /// `sand` (3,66) — e é a cor padrão de todo texto secundário.
  static const gray = Color(0xFF5C6671);
  static const line = Color(0xFFECE3D5);
  static const white = Color(0xFFFFFFFF);

  // `subtle` (#9AA7B2) foi removido: 2,46 sobre branco, longe dos 4,5
  // que texto exige, e nenhum arquivo o usava. Token que só serve para
  // reprovar é armadilha para quem for escrever a próxima tela.

  /// Texto secundário sobre superfícies escuras (cards ink).
  static const onInkMuted = Color(0xFFB9C2CC);

  /// Fundo dos ícones de ação destrutiva (ex.: "Sair").
  static const coralSoft = Color(0xFFFCE2DC);
}
