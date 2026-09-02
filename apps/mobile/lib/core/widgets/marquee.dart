import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_text.dart";

/// Faixa "ao vivo" que corre no topo do app — a voz vibrante do Rally.
///
/// Respeita `prefers-reduced-motion`: quando o sistema pede menos animação,
/// o texto fica parado em vez de rolar.
class MarqueeMarca extends StatefulWidget {
  const MarqueeMarca({super.key, required this.texto});

  final String texto;

  @override
  State<MarqueeMarca> createState() => _MarqueeMarcaState();
}

class _MarqueeMarcaState extends State<MarqueeMarca>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controle = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 18),
  );

  bool _semMovimento = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // A preferência pode mudar em tempo de execução (acessibilidade do SO).
    _semMovimento = MediaQuery.disableAnimationsOf(context);
    if (_semMovimento) {
      _controle.stop();
    } else if (!_controle.isAnimating) {
      _controle.repeat();
    }
  }

  @override
  void dispose() {
    _controle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final texto = Padding(
      padding: const EdgeInsets.only(right: 16),
      child: Text(
        widget.texto.toUpperCase(),
        maxLines: 1,
        softWrap: false,
        style: AppText.rotulo(11, cor: AppColors.sun),
      ),
    );

    return Container(
      width: double.infinity,
      color: AppColors.ink,
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(context).top + 9,
        bottom: 9,
      ),
      child: ClipRect(
        child: ExcludeSemantics(
          child: _semMovimento
              ? Padding(
                  padding: const EdgeInsets.only(left: 16),
                  child: texto,
                )
              : AnimatedBuilder(
                  animation: _controle,
                  builder: (context, _) {
                    return FractionalTranslation(
                      // Duas cópias lado a lado dão a volta sem emenda.
                      translation: Offset(-_controle.value / 2, 0),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [texto, texto],
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
