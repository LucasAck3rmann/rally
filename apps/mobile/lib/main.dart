import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:intl/date_symbol_data_local.dart";

import "core/app.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Datas em pt-BR ("Ter, 16 jun") dependem dos símbolos de locale.
  await initializeDateFormatting("pt_BR");
  runApp(const ProviderScope(child: RallyApp()));
}
