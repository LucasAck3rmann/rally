import "package:flutter_secure_storage/flutter_secure_storage.dart";

/// Guarda o token de acesso em **armazenamento seguro** do dispositivo
/// (Keychain no iOS, Keystore/EncryptedSharedPreferences no Android).
class TokenStore {
  const TokenStore(this._storage);

  final FlutterSecureStorage _storage;
  static const _kAccessToken = "rally.access_token";

  Future<void> save(String token) =>
      _storage.write(key: _kAccessToken, value: token);

  Future<String?> read() => _storage.read(key: _kAccessToken);

  Future<void> clear() => _storage.delete(key: _kAccessToken);
}
