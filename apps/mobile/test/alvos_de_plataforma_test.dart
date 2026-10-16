// SPDX-License-Identifier: AGPL-3.0-or-later
import "dart:io";

import "package:flutter_test/flutter_test.dart";

/// **Os alvos de plataforma que o RNF-09 promete (Android 8+).**
///
/// Este portão existe por um achado de 15/10: o `build.gradle.kts` usava
/// `minSdk = flutter.minSdkVersion`, que vale **24** nesta versão do SDK — ou
/// seja, **Android 7.0**. O requisito dizia "Android 8+" e o número vivia
/// **somente no documento**. O build aceitava Android 7, ninguém sabia, e uma
/// mudança no padrão do Flutter teria trocado o alvo do produto em silêncio.
///
/// É a mesma classe de defeito que o `doc-do-schema.spec.ts` prende na API:
/// um número afirmado num documento sem nada no sistema que o sustente. A
/// diferença é que aqui o número não era só desatualizado — ele nunca tinha
/// sido escrito em lugar nenhum.
///
/// **O que este teste não faz:** ele não prova que o aplicativo *roda* num
/// Android 8. Prova que o projeto **declara** esse alvo, o que é o que estava
/// faltando. Rodar em aparelho de verdade segue pendente e declarado — não há
/// SDK nem AVD na máquina de desenvolvimento, e o app nunca foi executado num
/// Android físico.
void main() {
  late String gradle;

  setUpAll(() {
    final arquivo = File("android/app/build.gradle.kts");
    expect(
      arquivo.existsSync(),
      isTrue,
      reason: "android/app/build.gradle.kts não encontrado — rode da raiz de "
          "apps/mobile. Sem isto o portão passaria sem ler nada.",
    );
    gradle = arquivo.readAsStringSync();
  });

  /// Lê um valor numérico declarado no Gradle, ou nulo se vier herdado.
  int? numeroDeclarado(String chave) {
    final achado = RegExp("$chave\\s*=\\s*(\\d+)").firstMatch(gradle);
    return achado == null ? null : int.parse(achado.group(1)!);
  }

  /// O arquivo como uma linha só, sem marcador de comentário nem ênfase.
  ///
  /// Existe porque a primeira versão deste teste procurava uma frase de
  /// comentário com `contains` e **reprovou por formatação**: a frase estava
  /// quebrada em duas linhas, de modo que o trecho contíguo não existia. Casar
  /// prosa sem normalizar testa a largura da linha, não o conteúdo.
  String prosa() => gradle
      .toLowerCase()
      .replaceAll(RegExp(r"[/*⚠️]"), " ")
      .replaceAll(RegExp(r"\s+"), " ");

  test("o minSdk é declarado, e não herdado do padrão do Flutter", () {
    // `flutter.minSdkVersion` é um padrão do SDK e muda entre versões. Alvo de
    // plataforma é decisão de produto, e decisão de produto não se herda.
    expect(
      gradle.contains("minSdk = flutter.minSdkVersion"),
      isFalse,
      reason: "o minSdk voltou a ser herdado; o alvo do RNF-09 deixaria de "
          "estar declarado em lugar nenhum",
    );
    expect(numeroDeclarado("minSdk"), isNotNull);
  });

  test("o minSdk é 26, que é o Android 8 que o RNF-09 promete", () {
    // 26 = Android 8.0 (Oreo). Se o requisito mudar, muda aqui junto — e é
    // esse acoplamento deliberado que impede os dois de divergirem.
    expect(numeroDeclarado("minSdk"), 26);
  });

  test("o identificador do aplicativo é o que a documentação declara", () {
    // `br.com.rally`, e não o `br.com.rally.rally_mobile` que o Flutter
    // derivou do nome da pasta. Trocar é de graça antes de publicar: depois
    // da primeira publicação o identificador é permanente.
    expect(gradle, contains('applicationId = "br.com.rally"'));
    expect(
      gradle.contains('applicationId = "br.com.rally.rally_mobile"'),
      isFalse,
    );
  });

  test("não sobrou TODO de scaffold sobre identificador", () {
    // O scaffold do Flutter deixa `TODO: Specify your own unique Application
    // ID`. Enquanto ele está lá, ninguém sabe se o identificador foi escolhido
    // ou aceito por omissão — que era exatamente o caso.
    expect(gradle.contains("TODO: Specify your own unique Application ID"),
        isFalse);
  });

  test("a pendência da assinatura de release fica declarada, não escondida",
      () {
    // **Build de release ainda é assinado com a chave de depuração**, o que a
    // Play Store recusa. Isso não é corrigível aqui — exige um keystore fora
    // do repositório —, e entra com a publicação (M5). O teste cobra que a
    // declaração continue no arquivo: apagá-la sem resolver o problema
    // transformaria uma pendência conhecida numa surpresa no dia da entrega.
    expect(gradle, contains("signingConfigs.getByName(\"debug\")"));
    expect(
      prosa(),
      contains("nao sobe para a play store"),
      reason: "a nota sobre a assinatura de depuração saiu do build.gradle.kts "
          "sem que a assinatura de release tenha sido resolvida",
    );
  });
}
