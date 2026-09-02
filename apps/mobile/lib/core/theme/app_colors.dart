import "package:flutter/material.dart";

/// Tokens de cor do design system Rally (ver DESIGN.md na raiz do repo).
abstract final class AppColors {
  static const coral = Color(0xFFFF6B4A);
  static const coralDeep = Color(0xFFC2410C);
  static const teal = Color(0xFF0FB5AE);
  static const sun = Color(0xFFFFC24B);
  static const sand = Color(0xFFF4E4CD);
  static const bg = Color(0xFFFFF7EE);
  static const ink = Color(0xFF1C2B33);
  static const gray = Color(0xFF6B7785);
  static const line = Color(0xFFECE3D5);
  static const white = Color(0xFFFFFFFF);

  /// Cinza mais claro para metadados de apoio.
  static const subtle = Color(0xFF9AA7B2);

  /// Texto secundário sobre superfícies escuras (cards ink).
  static const onInkMuted = Color(0xFFB9C2CC);

  /// Fundo dos ícones de ação destrutiva (ex.: "Sair").
  static const coralSoft = Color(0xFFFCE2DC);
}
