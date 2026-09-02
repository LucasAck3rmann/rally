import "package:flutter/material.dart";
import "package:flutter_svg/flutter_svg.dart";

import "../theme/app_colors.dart";

/// Ícone de linha do Rally, exportado do Figma (`assets/icons`).
///
/// Traço 2px, cantos arredondados e monocromático — a cor vem de um token, não
/// do arquivo. Largura e altura são sempre explícitas para preservar a
/// geometria desenhada.
class RallyIcon extends StatelessWidget {
  const RallyIcon(
    this.nome, {
    super.key,
    required this.tamanho,
    this.cor = AppColors.ink,
  });

  /// Nome do arquivo sem extensão, ex.: `"nav-inicio"`.
  final String nome;
  final double tamanho;

  /// `null` mantém as cores originais do arquivo (usado no emblema da marca).
  final Color? cor;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      "assets/icons/$nome.svg",
      width: tamanho,
      height: tamanho,
      colorFilter:
          cor == null ? null : ColorFilter.mode(cor!, BlendMode.srcIn),
    );
  }
}

/// Emblema da marca (mantém as cores próprias: coral, sol e grafite).
class RallyEmblema extends StatelessWidget {
  const RallyEmblema({super.key, this.tamanho = 24});

  final double tamanho;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      "assets/icons/emblema.svg",
      width: tamanho,
      height: tamanho,
    );
  }
}
