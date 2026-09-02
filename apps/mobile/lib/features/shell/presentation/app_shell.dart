import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/app_colors.dart";
import "../../../core/theme/app_text.dart";
import "../../../core/widgets/rally_icon.dart";

/// Casca do app do cliente: mantém a navegação inferior fixa enquanto as
/// abas trocam, preservando o estado de cada uma.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _abas = <_Aba>[
    _Aba(icone: "nav-inicio", rotulo: "Início"),
    _Aba(icone: "nav-reservas", rotulo: "Reservas"),
    _Aba(icone: "nav-replays", rotulo: "Replays"),
    _Aba(icone: "nav-perfil", rotulo: "Perfil"),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: navigationShell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(
              color: Color(0x0F000000),
              blurRadius: 8,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(34, 14, 34, 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (var i = 0; i < _abas.length; i++)
                  _ItemNav(
                    aba: _abas[i],
                    ativo: navigationShell.currentIndex == i,
                    onTap: () => navigationShell.goBranch(
                      i,
                      // Tocar na aba atual volta para a raiz dela.
                      initialLocation: i == navigationShell.currentIndex,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Aba {
  const _Aba({required this.icone, required this.rotulo});

  final String icone;
  final String rotulo;
}

class _ItemNav extends StatelessWidget {
  const _ItemNav({required this.aba, required this.ativo, required this.onTap});

  final _Aba aba;
  final bool ativo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: ativo,
      label: aba.rotulo,
      // O fundo branco vem do Container da barra, então aqui basta uma
      // superfície transparente para o ripple ser desenhado por cima.
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minWidth: 56, minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                RallyIcon(
                  aba.icone,
                  tamanho: 23,
                  cor: ativo ? AppColors.coral : AppColors.gray,
                ),
                const SizedBox(height: 6),
                Text(
                  aba.rotulo,
                  style: AppText.corpo(
                    11,
                    cor: ativo ? AppColors.ink : AppColors.gray,
                    peso: ativo ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
