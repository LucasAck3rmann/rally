// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "dart:convert";
import "dart:typed_data";

import "package:dio/dio.dart";

/// Adaptador de HTTP falso para testar os repositórios sem rede.
///
/// Escrito à mão em vez de trazer um pacote de dublê: a interface do Dio tem
/// **um** método que importa, e uma dependência a mais no `pubspec` custa mais
/// que estas quarenta linhas — além de prender o projeto à compatibilidade do
/// pacote a cada atualização do Dio.
///
/// Guarda as requisições recebidas, porque metade do que há para verificar num
/// repositório é **o que ele pediu**: o caminho, o método e os parâmetros de
/// consulta montados condicionalmente.
class AdaptadorFalso implements HttpClientAdapter {
  AdaptadorFalso();

  /// Respostas a devolver, em ordem de chamada.
  final List<_Resposta> _respostas = [];

  /// O que foi pedido, na ordem.
  final List<RequestOptions> pedidos = [];

  /// Enfileira uma resposta de sucesso com este corpo JSON.
  void responde(Object? corpo, {int status = 200}) {
    _respostas.add(_Resposta(corpo: corpo, status: status));
  }

  /// Enfileira uma falha do Dio — sem resposta (rede caída) ou com corpo.
  void falha({
    Object? corpo,
    int? status,
    DioExceptionType tipo = DioExceptionType.badResponse,
  }) {
    _respostas.add(_Resposta(status: status, corpo: corpo, tipoDeErro: tipo));
  }

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    pedidos.add(options);
    if (_respostas.isEmpty) {
      throw StateError(
        "O teste pediu ${options.method} ${options.path} e não havia resposta "
        "enfileirada — some um `responde(...)` ou sobra uma chamada.",
      );
    }
    final resposta = _respostas.removeAt(0);

    if (resposta.tipoDeErro != null) {
      throw DioException(
        requestOptions: options,
        type: resposta.tipoDeErro!,
        response: resposta.status == null
            ? null
            : Response<dynamic>(
                requestOptions: options,
                statusCode: resposta.status,
                data: resposta.corpo,
              ),
      );
    }

    return ResponseBody.fromString(
      jsonEncode(resposta.corpo),
      resposta.status ?? 200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _Resposta {
  _Resposta({this.corpo, this.status, this.tipoDeErro});

  final Object? corpo;
  final int? status;
  final DioExceptionType? tipoDeErro;
}

/// Um `Dio` apontado para o adaptador falso.
Dio dioFalso(AdaptadorFalso adaptador) {
  return Dio(BaseOptions(baseUrl: "http://localhost:3000"))
    ..httpClientAdapter = adaptador;
}
