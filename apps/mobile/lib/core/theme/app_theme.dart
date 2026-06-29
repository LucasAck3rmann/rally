import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

import "app_colors.dart";

/// Tema do app aplicando os tokens Rally.
/// Regra de acessibilidade: texto sobre coral é **grafite** (nunca branco).
ThemeData buildRallyTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.light);

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    colorScheme: const ColorScheme.light(
      primary: AppColors.coral,
      onPrimary: AppColors.ink,
      secondary: AppColors.teal,
      onSecondary: AppColors.ink,
      surface: AppColors.white,
      onSurface: AppColors.ink,
    ),
    textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: AppColors.ink,
      displayColor: AppColors.ink,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.coral,
        foregroundColor: AppColors.ink,
        minimumSize: const Size.fromHeight(52), // alvo de toque >= 44px
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.coral, width: 2),
      ),
    ),
  );
}
