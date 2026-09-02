import "package:flutter/material.dart";
import "package:flutter_localizations/flutter_localizations.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "router/app_router.dart";
import "theme/app_theme.dart";

class RallyApp extends ConsumerWidget {
  const RallyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: "Rally",
      debugShowCheckedModeBanner: false,
      theme: buildRallyTheme(),
      routerConfig: router,
      // A interface é toda em pt-BR (ver CLAUDE.md).
      locale: const Locale("pt", "BR"),
      supportedLocales: const [Locale("pt", "BR")],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
