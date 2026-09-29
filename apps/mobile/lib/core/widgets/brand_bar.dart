import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_text.dart";
import "rally_icon.dart";

/// Barra de marca do topo das telas do app: emblema + "Rally" + um rótulo
/// contextual à direita (cidade, seção...).
class BrandBar extends StatelessWidget {
  const BrandBar({super.key, required this.rotuloDireita, this.sufixo});

  final String rotuloDireita;

  /// Texto colado ao wordmark, como o "· perfil" da tela de Perfil.
  final String? sufixo;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            const RallyEmblema(),
            const SizedBox(width: 8),
            Text("Rally", style: AppText.titulo(16)),
            if (sufixo != null) ...[
              const SizedBox(width: 8),
              Text(sufixo!.toUpperCase(), style: AppText.rotulo(11)),
            ],
          ],
        ),
        Text(
          rotuloDireita.toUpperCase(),
          style: AppText.rotulo(11, espacamento: 0.5),
        ),
      ],
    );
  }
}

/// Cabeçalho branco com cantos inferiores arredondados usado no topo das telas.
///
/// O Figma desenha as telas sem barra de status; quando este cabeçalho é o
/// primeiro elemento, ele soma o recorte do topo ao próprio respiro.
class HeaderCard extends StatelessWidget {
  const HeaderCard({
    super.key,
    required this.child,
    this.paddingTop = 14,
    this.paddingBottom = 20,
    this.aplicarAreaSegura = true,
  });

  final Widget child;
  final double paddingTop;
  final double paddingBottom;

  /// `false` quando há algo acima (a faixa marquee da Home já cobre o recorte).
  final bool aplicarAreaSegura;

  @override
  Widget build(BuildContext context) {
    final recorte = aplicarAreaSegura ? MediaQuery.paddingOf(context).top : 0.0;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(20, paddingTop + recorte, 20, paddingBottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
        boxShadow: [
          BoxShadow(
            color: Color(0x0F000000),
            blurRadius: 9,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Cabeçalho de fluxo (voltar · título · passo), usado no checkout e no Pix.
class HeaderFluxo extends StatelessWidget {
  const HeaderFluxo({
    super.key,
    required this.titulo,
    required this.passo,
    this.onVoltar,
  });

  final String titulo;

  /// Ex.: "passo 2/2". Vira uma pílula areia à direita.
  final String passo;
  final VoidCallback? onVoltar;

  @override
  Widget build(BuildContext context) {
    return HeaderCard(
      paddingTop: 18,
      paddingBottom: 18,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _BotaoCircular(onTap: onVoltar),
          Flexible(
            child: Text(
              titulo,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.titulo(18),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.sand,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(passo.toUpperCase(), style: AppText.rotulo(10)),
          ),
        ],
      ),
    );
  }
}

class _BotaoCircular extends StatelessWidget {
  const _BotaoCircular({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: "Voltar",
      child: SizedBox(
        width: 44, // alvo de toque mínimo; o círculo desenhado tem 40
        height: 44,
        child: Center(
          child: Material(
            color: AppColors.sand,
            shape: const CircleBorder(),
            child: InkWell(
              onTap: onTap,
              customBorder: const CircleBorder(),
              child: const SizedBox(
                width: 40,
                height: 40,
                child: Center(child: RallyIcon("voltar", tamanho: 20)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
