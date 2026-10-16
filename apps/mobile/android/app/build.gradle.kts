plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "br.com.rally.rally_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // `br.com.rally`, e nao o `br.com.rally.rally_mobile` que o Flutter
        // derivou do nome da pasta. E o identificador que a documentacao do
        // projeto declara, e trocar e **de graca antes de publicar** — depois
        // da primeira publicacao o identificador e permanente e um app novo
        // perderia as instalacoes.
        applicationId = "br.com.rally"
        // **Android 8.0 (API 26), declarado — e nao herdado.** O RNF-09 promete
        // "Android 8+", e `flutter.minSdkVersion` vale **24** nesta versao do
        // SDK, que e Android 7.0. O numero estava so no documento: o build
        // aceitava Android 7 e ninguem sabia, e uma mudanca no padrao do
        // Flutter trocaria o alvo do produto sem ninguem notar. Fixar aqui faz
        // o documento e o build dizerem a mesma coisa, e o teste
        // `alvos_de_plataforma_test.dart` cobra os dois.
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // ⚠️ **Assinado com a chave de depuracao**, que e o scaffold do
            // Flutter e nao uma escolha. Build de release assim **nao sobe para
            // a Play Store**: ela recusa APK assinado com a chave de debug.
            // Resolver exige um keystore fora do repositorio (`key.properties`
            // no .gitignore), e isso entra junto com a publicacao (M5). Fica
            // declarado em vez de escondido atras de um TODO generico.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
