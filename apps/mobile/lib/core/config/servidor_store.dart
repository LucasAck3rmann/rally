// SPDX-License-Identifier: AGPL-3.0-or-later
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "app_config.dart";

/// Endereço da API, escolhido em tempo de execução.
///
/// **Sem isto o aplicativo instalado num aparelho não alcança servidor
/// nenhum.** O padrão de compilação é `http://10.0.2.2:3333/api/v1`, que é o
/// apelido do *host* dentro do **emulador** do Android: num celular de
/// verdade esse endereço não existe, e toda requisição morre em tempo de
/// conexão. O `--dart-define` resolveria, mas exige saber o IP da máquina na
/// hora de compilar — e numa apresentação o IP só se conhece ao chegar na
/// rede.
///
/// Guardar o endereço junto do token, no armazenamento seguro, evita somar
/// uma dependência só para isto. Não é segredo: é configuração, e está aqui
/// porque o armazenamento já existe e já é o lugar do que pertence a esta
/// instalação.
class ServidorStore {
  const ServidorStore(this._storage);

  final FlutterSecureStorage _storage;

  static const _chave = "servidor_base_url";

  /// O endereço escolhido, ou o padrão de compilação quando não há escolha.
  Future<String> ler() async {
    final guardado = await _storage.read(key: _chave);
    if (guardado == null || guardado.trim().isEmpty) {
      return AppConfig.apiBaseUrl;
    }
    return guardado.trim();
  }

  /// Guarda o endereço; vazio volta ao padrão de compilação.
  Future<void> gravar(String valor) async {
    final limpo = normalizar(valor);
    if (limpo.isEmpty) {
      await _storage.delete(key: _chave);
      return;
    }
    await _storage.write(key: _chave, value: limpo);
  }

  /// Aceita o que a pessoa digita e devolve o que o Dio precisa.
  ///
  /// Quem está numa feira digita `192.168.0.14` ou `192.168.0.14:3333`, não
  /// `http://192.168.0.14:3333/api/v1`. Exigir a forma completa troca uma
  /// demonstração por um erro de digitação, então as partes que faltam são
  /// completadas aqui — e a porta e o prefixo são os mesmos que o
  /// `.env.example` do projeto declara.
  static String normalizar(String valor) {
    var v = valor.trim();
    if (v.isEmpty) return "";
    if (!v.startsWith("http://") && !v.startsWith("https://")) {
      v = "http://$v";
    }
    final uri = Uri.parse(v);
    final caminho = uri.path.replaceAll(RegExp(r"/+$"), "");
    // A porta 3333 so e completada em `http`, que e o caso da maquina na
    // rede local. Em `https` o padrao e 443, e forcar 3333 ali apontaria o
    // aplicativo para uma porta onde nao ha nada -- defeito que o teste
    // achou antes de a primeira pessoa tentar um endereco publico.
    final porta = uri.hasPort ? uri.port : (uri.scheme == "http" ? 3333 : 0);
    return Uri(
      scheme: uri.scheme,
      host: uri.host,
      port: porta == 0 ? null : porta,
      path: caminho.isEmpty ? "/api/v1" : caminho,
    ).toString();
  }
}

final servidorStoreProvider = Provider<ServidorStore>(
  (ref) => const ServidorStore(FlutterSecureStorage()),
);
