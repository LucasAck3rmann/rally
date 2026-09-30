import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_text.dart";

/// Título de seção com ação opcional à direita ("Ver todas").
class CabecalhoSecao extends StatelessWidget {
  const CabecalhoSecao({
    super.key,
    required this.titulo,
    this.acao,
    this.onAcao,
  });

  final String titulo;
  final String? acao;
  final VoidCallback? onAcao;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Sem `Flexible`, um título comprido estoura a linha em tela
        // estreita em vez de truncar — a ação à direita não cede espaço.
        Flexible(
          child: Text(
            titulo,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.titulo(17),
          ),
        ),
        if (acao != null) ...[
          const SizedBox(width: 12),
          GestureDetector(
            onTap: onAcao,
            child: Text(
              acao!,
              // Coral puro falha o contraste em texto pequeno; usa coral-deep.
              style: AppText.corpo(
                13,
                cor: AppColors.coralDeep,
                peso: FontWeight.w600,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Estado vazio de uma lista, no tom do produto.
class EstadoVazio extends StatelessWidget {
  const EstadoVazio({super.key, required this.titulo, required this.descricao});

  final String titulo;
  final String descricao;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Text(titulo, textAlign: TextAlign.center, style: AppText.titulo(16)),
          const SizedBox(height: 6),
          Text(
            descricao,
            textAlign: TextAlign.center,
            style: AppText.corpo(13, cor: AppColors.gray),
          ),
        ],
      ),
    );
  }
}

/// Erro de carregamento com opção de tentar de novo.
class EstadoErro extends StatelessWidget {
  const EstadoErro({super.key, required this.mensagem, this.onTentarDeNovo});

  final String mensagem;
  final VoidCallback? onTentarDeNovo;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Text(
            "Não deu para carregar",
            textAlign: TextAlign.center,
            style: AppText.titulo(16),
          ),
          const SizedBox(height: 6),
          Text(
            mensagem,
            textAlign: TextAlign.center,
            style: AppText.corpo(13, cor: AppColors.gray),
          ),
          if (onTentarDeNovo != null) ...[
            const SizedBox(height: 14),
            TextButton(
              onPressed: onTentarDeNovo,
              child: Text(
                "Tentar de novo",
                style: AppText.corpo(
                  14,
                  cor: AppColors.coralDeep,
                  peso: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
