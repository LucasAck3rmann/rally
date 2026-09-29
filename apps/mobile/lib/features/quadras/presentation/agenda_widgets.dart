// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:flutter/material.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../domain/quadra.dart";

/// Peças da grade de horários, compartilhadas pelo detalhe da quadra e pela
/// remarcação de uma reserva — as duas telas escolhem um slot do mesmo jeito.

/// Cartão de um dia no seletor horizontal.
class CartaoDia extends StatelessWidget {
  const CartaoDia({
    super.key,
    required this.rotulo,
    required this.numero,
    required this.ativo,
    required this.onTap,
  });

  final String rotulo;
  final int numero;
  final bool ativo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: ativo,
      child: Material(
        color: ativo ? AppColors.coral : AppColors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            width: 62,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: ativo ? null : Border.all(color: AppColors.line),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  rotulo,
                  style: AppText.corpo(
                    11,
                    cor: ativo ? AppColors.ink : AppColors.gray,
                    peso: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text("$numero", style: AppText.titulo(15)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Cartão de um horário na grade. Alvo de 44px, como pede o DESIGN.md.
class CartaoSlot extends StatelessWidget {
  const CartaoSlot({
    super.key,
    required this.slot,
    required this.escolhido,
    required this.onTap,
  });

  final Slot slot;
  final bool escolhido;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final indisponivel = !slot.disponivel;

    return Semantics(
      button: true,
      selected: escolhido,
      enabled: !indisponivel,
      label: indisponivel ? "${slot.hora}, indisponível" : slot.hora,
      child: Opacity(
        opacity: indisponivel ? 0.55 : 1,
        child: Material(
          color: indisponivel
              ? AppColors.sand
              : escolhido
                  ? AppColors.coral
                  : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              height: 44,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: indisponivel || escolhido
                    ? null
                    : Border.all(color: AppColors.line),
              ),
              child: Text(
                slot.hora,
                style: AppText.corpo(
                  14,
                  cor: indisponivel ? AppColors.gray : AppColors.ink,
                  peso: escolhido
                      ? FontWeight.w700
                      : indisponivel
                          ? FontWeight.w500
                          : FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
