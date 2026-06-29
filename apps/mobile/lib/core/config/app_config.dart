/// Configuração do app (origens externas).
abstract final class AppConfig {
  /// Base da API. No **emulador Android**, `10.0.2.2` aponta para o host;
  /// no **simulador iOS** use `localhost`. Em build, sobrescreva com
  /// `--dart-define=API_BASE_URL=https://api.suaurl.com/api/v1`.
  static const apiBaseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: "http://10.0.2.2:3333/api/v1",
  );
}
