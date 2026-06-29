import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

import "../../../core/theme/app_colors.dart";

/// Tela de abertura. O destino (login x home) é decidido pelo guard do
/// router conforme o estado de autenticação.
class SplashPage extends StatelessWidget {
  const SplashPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.ink,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.coral,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Text(
                "R",
                style: GoogleFonts.sora(
                  fontSize: 46,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
            ),
            const SizedBox(height: 22),
            Text(
              "Rally",
              style: GoogleFonts.sora(
                fontSize: 30,
                fontWeight: FontWeight.w700,
                color: AppColors.white,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              "DO AGENDAMENTO AO REPLAY",
              style: GoogleFonts.spaceMono(
                fontSize: 11,
                letterSpacing: 2.5,
                color: AppColors.sand,
              ),
            ),
            const SizedBox(height: 36),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.coral,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
