import "package:flutter/material.dart";
import "package:flutter_svg/flutter_svg.dart";

import "../theme/app_colors.dart";

/// Confete decorativo da tela de confirmação.
///
/// As peças ficam posicionadas em fração da largura, então acompanham qualquer
/// tamanho de tela mantendo o arranjo do design (feito sobre 390px).
class ConfeteConfirmacao extends StatelessWidget {
  const ConfeteConfirmacao({super.key});

  // (fração da largura, distância do topo, peça)
  static const _pecas = <(double, double, _Peca)>[
    (50 / 390, 8, _Peca.quadradoTeal),
    (36.6 / 390, 48, _Peca.quadradoSun),
    (60 / 390, 70, _Peca.circuloSun),
    (322 / 390, 24, _Peca.circuloCoral),
    (297.3 / 390, 70, _Peca.trianguloCoral),
    (326 / 390, 79, _Peca.trianguloTeal),
  ];

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: LayoutBuilder(
        builder: (context, restricoes) {
          return Stack(
            clipBehavior: Clip.none,
            children: [
              for (final (fracao, topo, peca) in _pecas)
                Positioned(
                  left: restricoes.maxWidth * fracao,
                  top: topo,
                  child: peca.build(),
                ),
            ],
          );
        },
      ),
    );
  }
}

enum _Peca {
  quadradoTeal,
  quadradoSun,
  circuloCoral,
  circuloSun,
  trianguloCoral,
  trianguloTeal;

  Widget build() => switch (this) {
        _Peca.quadradoTeal => _quadrado(AppColors.teal, -0.05),
        _Peca.quadradoSun => _quadrado(AppColors.sun, 0.05),
        _Peca.circuloCoral => _svg("ellipse-coral", 10, 10),
        _Peca.circuloSun => _svg("ellipse-sun", 10, 10),
        _Peca.trianguloCoral => Transform.rotate(
            angle: 0.21,
            child: _svg("poly-coral", 11.26, 9.75),
          ),
        _Peca.trianguloTeal => Transform.rotate(
            angle: -0.42,
            child: _svg("poly-teal", 11.26, 9.75),
          ),
      };

  static Widget _quadrado(Color cor, double giro) {
    return Transform.rotate(
      angle: giro * 6.28,
      child: Container(
        width: 11,
        height: 11,
        decoration: BoxDecoration(
          color: cor,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }

  static Widget _svg(String nome, double largura, double altura) {
    return SvgPicture.asset(
      "assets/confete/$nome.svg",
      width: largura,
      height: altura,
    );
  }
}
