import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

import "app_colors.dart";

/// Tipografia do Rally — três famílias com papéis fixos (ver DESIGN.md):
/// **Sora** em títulos/marca/preços, **Inter** no corpo e na UI, e
/// **Space Mono** em rótulos, metadados e números (sempre em CAIXA ALTA).
///
/// A entrelinha é 1,3 em todo o sistema, o que reproduz os Text Styles do
/// Figma (ex.: Sora 20/26, Inter 13/17, Mono 11/14).
abstract final class AppText {
  /// Entrelinha única do sistema. Pública porque quem reserva altura
  /// para N linhas — uma lista horizontal, por exemplo — precisa dela.
  static const entrelinha = 1.3;

  /// Sora — títulos, nomes e preços.
  static TextStyle titulo(
    double tamanho, {
    Color cor = AppColors.ink,
    FontWeight peso = FontWeight.w700,
  }) {
    return GoogleFonts.sora(
      fontSize: tamanho,
      fontWeight: peso,
      color: cor,
      height: entrelinha,
    );
  }

  /// Inter — corpo, botões e itens de interface.
  static TextStyle corpo(
    double tamanho, {
    Color cor = AppColors.ink,
    FontWeight peso = FontWeight.w400,
  }) {
    return GoogleFonts.inter(
      fontSize: tamanho,
      fontWeight: peso,
      color: cor,
      height: entrelinha,
    );
  }

  /// Space Mono — rótulos, metadados e números. Use com o texto em maiúsculas.
  static TextStyle rotulo(
    double tamanho, {
    Color cor = AppColors.gray,
    double espacamento = 0.6,
  }) {
    return GoogleFonts.spaceMono(
      fontSize: tamanho,
      color: cor,
      letterSpacing: espacamento,
      height: entrelinha,
    );
  }
}
