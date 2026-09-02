import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_text.dart";
import "../formato.dart";

/// Barra fixa branca do rodapé com preço à esquerda e CTA à direita
/// (detalhe da quadra e checkout).
class BarraPrecoCta extends StatelessWidget {
  const BarraPrecoCta({
    super.key,
    required this.valor,
    required this.legenda,
    required this.rotuloCta,
    this.onCta,
    this.iconeCta,
    this.carregando = false,
  });

  final double valor;

  /// Ex.: "por hora", "no Pix".
  final String legenda;
  final String rotuloCta;
  final VoidCallback? onCta;
  final Widget? iconeCta;
  final bool carregando;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        16 + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 8,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(Formato.moeda(valor), style: AppText.titulo(20)),
              const SizedBox(height: 1),
              Text(legenda.toUpperCase(), style: AppText.rotulo(11, espacamento: 0.5)),
            ],
          ),
          BotaoPrimario(
            rotulo: rotuloCta,
            onPressed: onCta,
            icone: iconeCta,
            carregando: carregando,
            expandir: false,
          ),
        ],
      ),
    );
  }
}

/// Botão primário do Rally: coral com texto **grafite** (nunca branco — o
/// contraste do branco sobre coral não passa em AA).
class BotaoPrimario extends StatelessWidget {
  const BotaoPrimario({
    super.key,
    required this.rotulo,
    this.onPressed,
    this.icone,
    this.carregando = false,
    this.expandir = true,
  });

  final String rotulo;
  final VoidCallback? onPressed;
  final Widget? icone;
  final bool carregando;
  final bool expandir;

  @override
  Widget build(BuildContext context) {
    final conteudo = carregando
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2.4,
              color: AppColors.ink,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icone != null) ...[icone!, const SizedBox(width: 8)],
              Flexible(
                child: Text(
                  rotulo,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.corpo(15, peso: FontWeight.w700),
                ),
              ),
            ],
          );

    final botao = Opacity(
      opacity: onPressed == null && !carregando ? 0.5 : 1,
      child: Material(
        color: AppColors.coral,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: carregando ? null : onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            height: 50,
            alignment: Alignment.center,
            padding: EdgeInsets.symmetric(horizontal: expandir ? 20 : 24),
            child: conteudo,
          ),
        ),
      ),
    );

    return expandir ? SizedBox(width: double.infinity, child: botao) : botao;
  }
}

/// Botão secundário: branco com borda `line` (ações de apoio).
class BotaoSecundario extends StatelessWidget {
  const BotaoSecundario({
    super.key,
    required this.rotulo,
    this.onPressed,
    this.icone,
  });

  final String rotulo;
  final VoidCallback? onPressed;
  final Widget? icone;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.line, width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icone != null) ...[icone!, const SizedBox(width: 8)],
              Text(rotulo, style: AppText.corpo(14, peso: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}
