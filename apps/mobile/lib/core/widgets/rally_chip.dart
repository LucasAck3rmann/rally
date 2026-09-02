import "package:flutter/material.dart";

import "../theme/app_colors.dart";
import "../theme/app_text.dart";

/// Chip de filtro (modalidades na Home, período nos Replays).
/// Ativo = coral com texto grafite; inativo = branco com borda `line`.
class RallyChip extends StatelessWidget {
  const RallyChip({
    super.key,
    required this.rotulo,
    required this.ativo,
    this.onTap,
  });

  final String rotulo;
  final bool ativo;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: ativo,
      // Material por fora pinta o fundo, para o ripple do InkWell aparecer.
      child: Material(
        color: ativo ? AppColors.coral : AppColors.white,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Container(
            // 44px de alvo de toque com o mesmo desenho do Figma (9px de padding).
            constraints: const BoxConstraints(minHeight: 44),
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              border: ativo ? null : Border.all(color: AppColors.line),
            ),
            child: Text(
              rotulo,
              style: AppText.corpo(
                13,
                peso: ativo ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
