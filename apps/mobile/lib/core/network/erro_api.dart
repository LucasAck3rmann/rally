import "package:dio/dio.dart";

/// Falha ao falar com a API, já traduzida para uma mensagem de tela.
class ApiException implements Exception {
  const ApiException(this.mensagem, {this.status});

  final String mensagem;

  /// Código HTTP, quando houve resposta (409 = horário tomado, por exemplo).
  final int? status;

  @override
  String toString() => mensagem;
}

/// Converte um erro do Dio na mensagem que o usuário vê.
///
/// Prioriza o `message` que a API mandou (o Nest devolve mensagens em pt-BR
/// prontas para exibição) e cai num texto genérico quando não há resposta.
String mensagemDeDio(DioException erro, {required String padrao}) {
  final dados = erro.response?.data;
  if (dados is Map) {
    final mensagem = dados["message"];
    if (mensagem is String && mensagem.isNotEmpty) {
      return mensagem;
    }
    if (mensagem is List && mensagem.isNotEmpty) {
      return mensagem.first.toString();
    }
  }
  if (erro.type == DioExceptionType.connectionError ||
      erro.type == DioExceptionType.connectionTimeout ||
      erro.type == DioExceptionType.receiveTimeout) {
    return "Sem conexão com o servidor.";
  }
  return padrao;
}

/// Açúcar para os repositórios: executa a chamada e normaliza o erro.
Future<T> chamarApi<T>(
  Future<T> Function() acao, {
  required String erroPadrao,
}) async {
  try {
    return await acao();
  } on DioException catch (erro) {
    throw ApiException(
      mensagemDeDio(erro, padrao: erroPadrao),
      status: erro.response?.statusCode,
    );
  }
}
