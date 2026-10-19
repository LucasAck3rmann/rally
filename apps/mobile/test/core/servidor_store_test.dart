// SPDX-License-Identifier: AGPL-3.0-or-later
import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/core/config/servidor_store.dart";

/// **O que a pessoa digita numa feira e o que o Dio precisa não são a mesma
/// coisa.** Quem está com o celular na mão digita `192.168.0.14`; o cliente
/// HTTP precisa de `http://192.168.0.14:3333/api/v1`. Exigir a forma
/// completa troca uma demonstração por um erro de digitação, e é por isso
/// que a normalização existe — com teste, porque completar partes que
/// faltam é exatamente onde se erra em silêncio.
void main() {
  group("ServidorStore.normalizar", () {
    test("só o IP ganha esquema, porta e caminho", () {
      expect(
        ServidorStore.normalizar("192.168.0.14"),
        "http://192.168.0.14:3333/api/v1",
      );
    });

    test("com porta, mantém a porta e completa o caminho", () {
      expect(
        ServidorStore.normalizar("192.168.0.14:8080"),
        "http://192.168.0.14:8080/api/v1",
      );
    });

    test("endereço completo passa intacto", () {
      expect(
        ServidorStore.normalizar("http://10.0.0.2:3333/api/v1"),
        "http://10.0.0.2:3333/api/v1",
      );
    });

    test("https é preservado, e não trocado por http", () {
      // Rebaixar para http numa rede alheia exporia o token de sessão.
      // E a porta 3333 **não** é completada aqui: em https o padrão é 443,
      // e forçar 3333 apontaria para uma porta onde não há nada.
      expect(
        ServidorStore.normalizar("https://api.rally.com.br/api/v1"),
        "https://api.rally.com.br/api/v1",
      );
    });

    test("barra no fim não vira caminho vazio", () {
      expect(
        ServidorStore.normalizar("192.168.0.14:3333/"),
        "http://192.168.0.14:3333/api/v1",
      );
    });

    test("espaço em volta é aparado", () {
      expect(
        ServidorStore.normalizar("  192.168.0.14  "),
        "http://192.168.0.14:3333/api/v1",
      );
    });

    test("vazio continua vazio, que é o sinal de voltar ao padrão", () {
      // String vazia **não** vira `http://:3333/api/v1`: é o valor que manda
      // apagar a escolha e usar o padrão de compilação.
      expect(ServidorStore.normalizar("   "), "");
    });
  });
}
