import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:google_fonts/google_fonts.dart";

import "../../../core/theme/app_colors.dart";
import "../../auth/presentation/auth_controller.dart";

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).valueOrNull;
    final nome = user?.nome ?? "Jogador";

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "OLÁ",
                      style: GoogleFonts.spaceMono(
                        fontSize: 11,
                        letterSpacing: 2,
                        color: AppColors.gray,
                      ),
                    ),
                    Text(
                      nome,
                      style: GoogleFonts.sora(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  tooltip: "Sair",
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).logout(),
                  icon: const Icon(Icons.logout, color: AppColors.ink),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _banner(),
            const SizedBox(height: 22),
            Text(
              "Comece por aqui",
              style: GoogleFonts.sora(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 12),
            _card(Icons.search, "Buscar quadras", "Encontre uma quadra perto de você"),
            const SizedBox(height: 10),
            _card(Icons.calendar_today, "Minhas reservas", "Acompanhe seus horários"),
            const SizedBox(height: 10),
            _card(Icons.sports_tennis, "Meus replays", "Reveja os melhores pontos"),
          ],
        ),
      ),
    );
  }

  Widget _banner() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Bora jogar hoje?",
            style: GoogleFonts.sora(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.white,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            "Reserve sua quadra de areia em segundos.",
            style: TextStyle(color: AppColors.sand),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: () {},
            child: const Text("Reservar agora"),
          ),
        ],
      ),
    );
  }

  Widget _card(IconData icon, String titulo, String sub) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.sand,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.coralDeep),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  titulo,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  sub,
                  style: const TextStyle(color: AppColors.gray, fontSize: 13),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.gray),
        ],
      ),
    );
  }
}
