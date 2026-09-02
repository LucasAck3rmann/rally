import "package:flutter/material.dart";
import "package:flutter_svg/flutter_svg.dart";

import "../theme/app_colors.dart";
import "../theme/app_text.dart";

/// Selo de avaliação (estrela preenchida + nota) sobre fundo areia.
///
/// A estrela é o único ícone preenchido do sistema (ver DESIGN.md). Ela ocupa
/// uma caixa quadrada, com o desenho um pouco menor que a caixa — a mesma
/// proporção do Figma (11,41 × 10,85 numa caixa de 12).
class EstrelaNota extends StatelessWidget {
  const EstrelaNota({super.key, required this.nota, this.compacto = true});

  final double nota;

  /// `true` = versão dos cards (12px); `false` = versão do detalhe (13px).
  final bool compacto;

  static const _proporcaoLargura = 11.4127 / 12;
  static const _proporcaoAltura = 10.8541 / 12;

  @override
  Widget build(BuildContext context) {
    final caixa = compacto ? 12.0 : 13.0;

    return Container(
      padding: EdgeInsets.fromLTRB(
        compacto ? 8 : 9,
        compacto ? 5 : 6,
        compacto ? 9 : 11,
        compacto ? 5 : 6,
      ),
      decoration: BoxDecoration(
        color: AppColors.sand,
        borderRadius: BorderRadius.circular(compacto ? 9 : 10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: caixa,
            height: caixa,
            child: Align(
              alignment: Alignment.topCenter,
              child: SvgPicture.asset(
                "assets/icons/estrela.svg",
                width: caixa * _proporcaoLargura,
                height: caixa * _proporcaoAltura,
              ),
            ),
          ),
          const SizedBox(width: 4),
          Text(
            nota.toStringAsFixed(1),
            style: AppText.corpo(compacto ? 12 : 13, peso: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
