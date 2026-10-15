// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

/// Lê `coverage/lcov.info` e reprova se a cobertura cair abaixo do piso.
///
/// O aplicativo rodava 206 testes **sem nunca medir cobertura**, enquanto a
/// API mede e tem piso desde setembro. Ninguém sabia se aqueles testes cobriam
/// 40% ou 90% — a resposta, medida em 14/10, foi **77,74% de linhas**, acima
/// dos 70% que o RNF-13 exige. O valor de ter medido não foi o número: foi
/// descobrir **onde** falta.
///
/// O `flutter test --coverage` só mede linha; não há ramo nem função no lcov
/// que ele gera. Então o piso é de linha, e dizer isso importa — a assimetria
/// que a API expõe (ramos e funções abaixo de instruções) é invisível aqui, e
/// não por estar resolvida.
///
///     dart run tool/cobertura.dart            # usa o piso padrão
///     dart run tool/cobertura.dart --piso 80  # exige mais
///     dart run tool/cobertura.dart --detalhe  # lista os piores arquivos
library;

import "dart:io";

/// Piso de linha. **Um ponto abaixo do medido, não colado nele:** piso
/// colado na medida reprova na primeira linha nova que alguém não cubra, o
/// que é ruído, e ensina a baixar o piso em vez de escrever o teste. Foi a
/// lição aprendida na API em 13/10.
///
/// A primeira medição, com 206 testes, deu **77,74%**. Com as cinco suítes de
/// repositório — a camada que fala HTTP e desserializa JSON, que estava
/// **inteiramente sem cobertura** porque os testes de interface usam
/// repositórios falsos — são 291 testes e **88,52%**.
const double pisoPadrao = 87;

void main(List<String> argumentos) {
  final piso = _lerPiso(argumentos);
  final detalhe = argumentos.contains("--detalhe");

  final arquivo = File("coverage/lcov.info");
  if (!arquivo.existsSync()) {
    stderr.writeln(
      "Não achei coverage/lcov.info.\n\n"
      "Rode primeiro:  flutter test --coverage",
    );
    exit(2);
  }

  final porArquivo = _lerLcov(arquivo.readAsLinesSync());
  if (porArquivo.isEmpty) {
    stderr.writeln("O lcov.info não tem nenhum arquivo medido.");
    exit(2);
  }

  var achadas = 0;
  var atingidas = 0;
  for (final medida in porArquivo.values) {
    achadas += medida.achadas;
    atingidas += medida.atingidas;
  }
  final taxa = 100 * atingidas / achadas;

  stdout.writeln("Cobertura de linha: "
      "${taxa.toStringAsFixed(2)}% ($atingidas de $achadas) "
      "em ${porArquivo.length} arquivos");

  if (detalhe) {
    final piores = porArquivo.entries
        .where((e) => e.value.achadas > 15)
        .toList()
      ..sort((a, b) => a.value.taxa.compareTo(b.value.taxa));
    stdout.writeln("\nPiores arquivos com mais de 15 linhas:");
    for (final e in piores.take(15)) {
      stdout.writeln("  ${e.value.taxa.toStringAsFixed(1).padLeft(5)}%  "
          "${e.value.achadas.toString().padLeft(4)} linhas  ${e.key}");
    }
  }

  if (taxa < piso) {
    stderr.writeln(
      "\nAbaixo do piso de ${piso.toStringAsFixed(0)}%.\n\n"
      "Se a queda é esperada porque entrou código novo, **escreva o teste** —\n"
      "baixar o piso é o que esta verificação existe para impedir.",
    );
    exit(1);
  }
  stdout.writeln("Piso de ${piso.toStringAsFixed(0)}% atendido.");
}

double _lerPiso(List<String> argumentos) {
  final i = argumentos.indexOf("--piso");
  if (i == -1 || i + 1 >= argumentos.length) return pisoPadrao;
  final valor = double.tryParse(argumentos[i + 1]);
  if (valor == null) {
    stderr.writeln("--piso precisa de um número.");
    exit(2);
  }
  return valor;
}

class _Medida {
  int achadas = 0;
  int atingidas = 0;
  double get taxa => achadas == 0 ? 100 : 100 * atingidas / achadas;
}

/// Soma `LF:` e `LH:` por arquivo do lcov.
Map<String, _Medida> _lerLcov(List<String> linhas) {
  final porArquivo = <String, _Medida>{};
  var atual = "";
  for (final linha in linhas) {
    if (linha.startsWith("SF:")) {
      // Normaliza a barra: no Windows o lcov sai com barra invertida, e o
      // mesmo arquivo apareceria duas vezes entre sistemas.
      atual = linha.substring(3).replaceAll(r"\", "/");
      porArquivo.putIfAbsent(atual, _Medida.new);
    } else if (linha.startsWith("LF:")) {
      porArquivo[atual]!.achadas += int.parse(linha.substring(3));
    } else if (linha.startsWith("LH:")) {
      porArquivo[atual]!.atingidas += int.parse(linha.substring(3));
    }
  }
  return porArquivo;
}
