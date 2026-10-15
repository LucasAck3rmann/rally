// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally

import "package:dio/dio.dart";
import "package:flutter_test/flutter_test.dart";
import "package:rally_mobile/features/auth/data/auth_repository_impl.dart";
import "package:rally_mobile/features/auth/domain/auth_repository.dart";

import "../../fakes/adaptador_falso.dart";
import "../../fakes/token_store_falso.dart";

/// **O repositório de autenticação, que estava em 7,7%.**
///
/// É quem guarda e descarta o token, de modo que um defeito aqui não dá erro
/// de tela: dá sessão perdida. Foi exatamente o que a cobertura encontrou — o
/// `currentUser` apagava o token em **qualquer** falha do Dio, inclusive falta
/// de rede, de modo que abrir o aplicativo sem internet **deslogava a
/// pessoa**. A correção e o teste que a prende estão abaixo.
void main() {
  late AdaptadorFalso adaptador;
  late TokenStoreFalso tokens;
  late AuthRepositoryImpl repositorio;

  void montar({String? tokenInicial}) {
    adaptador = AdaptadorFalso();
    tokens = TokenStoreFalso(inicial: tokenInicial);
    repositorio = AuthRepositoryImpl(dioFalso(adaptador), tokens);
  }

  setUp(montar);

  Map<String, dynamic> envelope({String token = "jwt.de.teste"}) {
    return {
      "accessToken": token,
      "user": {"id": "u1", "nome": "Lucas", "email": "lucas@arena.com.br"},
    };
  }

  group("login", () {
    test("manda e-mail e senha, guarda o token e devolve o usuário", () async {
      adaptador.responde(envelope());

      final usuario = await repositorio.login(
        email: "lucas@arena.com.br",
        senha: "senha123",
      );

      expect(adaptador.pedidos.single.path, "/auth/login");
      expect(adaptador.pedidos.single.data, {
        "email": "lucas@arena.com.br",
        "senha": "senha123",
      });
      expect(tokens.token, "jwt.de.teste");
      expect(usuario.nome, "Lucas");
    });

    test("credencial errada traz a mensagem genérica da API", () async {
      // A API responde a mesma coisa para e-mail inexistente e senha errada,
      // de propósito — e a tela não pode desfazer isso inventando "e-mail não
      // cadastrado", que entregaria a lista de clientes da arena.
      adaptador
          .falha(status: 401, corpo: {"message": "Credenciais inválidas."});

      await expectLater(
        repositorio.login(email: "x@y.com", senha: "errada"),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            "message",
            "Credenciais inválidas.",
          ),
        ),
      );
      expect(tokens.token, isNull, reason: "login falho não guarda token");
    });

    test("resposta sem token é recusada, e nada é guardado", () async {
      // Guardar string vazia deixaria o aplicativo "logado" com um token que
      // a API recusa em toda chamada — pior que não logar.
      adaptador.responde({
        "user": {"id": "u1"}
      });

      await expectLater(
        repositorio.login(email: "a@b.com", senha: "x"),
        throwsA(isA<AuthException>()),
      );
      expect(tokens.token, isNull);
    });

    test("token vazio também é recusado", () async {
      adaptador.responde(envelope(token: ""));

      await expectLater(
        repositorio.login(email: "a@b.com", senha: "x"),
        throwsA(isA<AuthException>()),
      );
    });

    test("usuário ausente na resposta é recusado depois de salvar", () async {
      // O token já foi salvo quando o usuário falta; o erro é explícito em
      // vez de devolver um `AuthUser` vazio que a tela mostraria como nome em
      // branco.
      adaptador.responde({"accessToken": "jwt"});

      await expectLater(
        repositorio.login(email: "a@b.com", senha: "x"),
        throwsA(isA<AuthException>()),
      );
    });
  });

  group("cadastro", () {
    test("manda o aceite dos termos, que a API exige", () async {
      // O `@Equals(true)` da API recusa ausência e recusa `false`; mandar o
      // campo é o que faz o cadastro funcionar depois do #93.
      adaptador.responde(envelope());

      await repositorio.register(
        nome: "Lucas",
        email: "lucas@arena.com.br",
        senha: "senha123",
        aceitouTermos: true,
      );

      expect(adaptador.pedidos.single.path, "/auth/register");
      expect(adaptador.pedidos.single.data, {
        "nome": "Lucas",
        "email": "lucas@arena.com.br",
        "senha": "senha123",
        "aceitouTermos": true,
      });
    });

    test("o cadastro já entra com sessão aberta", () async {
      // A API devolve o mesmo envelope do login, então a pessoa não digita a
      // senha duas vezes.
      adaptador.responde(envelope(token: "jwt.novo"));

      await repositorio.register(
        nome: "A",
        email: "a@b.com",
        senha: "x",
        aceitouTermos: true,
      );

      expect(tokens.token, "jwt.novo");
    });

    test("e-mail já cadastrado traz a mensagem da API", () async {
      adaptador.falha(
        status: 409,
        corpo: {"message": "Este e-mail já está cadastrado."},
      );

      await expectLater(
        repositorio.register(
          nome: "A",
          email: "a@b.com",
          senha: "x",
          aceitouTermos: true,
        ),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            "message",
            "Este e-mail já está cadastrado.",
          ),
        ),
      );
    });
  });

  group("recuperação de senha", () {
    test("manda só o e-mail", () async {
      adaptador.responde(<String, dynamic>{});

      await repositorio.pedirLinkDeSenha(email: "lucas@arena.com.br");

      expect(adaptador.pedidos.single.path, "/auth/recuperar-senha");
      expect(adaptador.pedidos.single.data, {"email": "lucas@arena.com.br"});
    });

    test("nenhuma falha vira 'esse e-mail não existe'", () async {
      // A API responde igual para endereço cadastrado e não cadastrado, por
      // decisão de segurança. Se a mensagem daqui pudesse revelar a
      // existência da conta, a decisão da API seria desfeita pelo cliente.
      adaptador.falha(status: 500);

      final erro = await repositorio
          .pedirLinkDeSenha(email: "nao-existe@x.com")
          .then<Object?>((_) => null)
          .catchError((Object e) => e);

      expect(erro, isA<AuthException>());
      expect((erro! as AuthException).message, isNot(contains("existe")));
      expect((erro as AuthException).message, isNot(contains("cadastrad")));
    });
  });

  group("sessão atual", () {
    test("sem token guardado, não chama a API", () async {
      await expectLater(repositorio.currentUser(), completion(isNull));
      expect(adaptador.pedidos, isEmpty);
    });

    test("token vazio conta como sem sessão", () async {
      montar(tokenInicial: "");
      await expectLater(repositorio.currentUser(), completion(isNull));
      expect(adaptador.pedidos, isEmpty);
    });

    test("com token válido, devolve o usuário", () async {
      montar(tokenInicial: "jwt.bom");
      adaptador.responde({
        "id": "u1",
        "nome": "Lucas",
        "email": "lucas@arena.com.br",
      });

      final usuario = await repositorio.currentUser();

      expect(adaptador.pedidos.single.path, "/auth/me");
      expect(usuario!.nome, "Lucas");
      expect(tokens.token, "jwt.bom", reason: "sessão válida não é apagada");
    });

    test("401 apaga o token, porque a sessão acabou de verdade", () async {
      montar(tokenInicial: "jwt.expirado");
      adaptador.falha(status: 401, corpo: {"message": "Token expirado."});

      await expectLater(repositorio.currentUser(), completion(isNull));
      expect(tokens.token, isNull);
      expect(tokens.limpezas, 1);
    });

    test("sem rede, NÃO apaga o token — era o defeito", () async {
      // ⚠️ **O defeito que esta suíte encontrou.** O `catch` original pegava
      // qualquer `DioException` e apagava o token, de modo que abrir o
      // aplicativo no metrô, ou com o servidor fora do ar, **deslogava a
      // pessoa de forma permanente** — ela voltaria a ter conexão e ainda
      // precisaria digitar a senha outra vez.
      //
      // Falta de rede não diz nada sobre a validade do token. Só o 401 diz.
      montar(tokenInicial: "jwt.bom");
      adaptador.falha(tipo: DioExceptionType.connectionError);

      await expectLater(repositorio.currentUser(), completion(isNull));
      expect(
        tokens.token,
        "jwt.bom",
        reason: "o token sobrevive à falta de rede",
      );
      expect(tokens.limpezas, 0);
    });

    test("tempo esgotado também preserva o token", () async {
      montar(tokenInicial: "jwt.bom");
      adaptador.falha(tipo: DioExceptionType.receiveTimeout);

      await expectLater(repositorio.currentUser(), completion(isNull));
      expect(tokens.token, "jwt.bom");
    });

    test("500 do servidor preserva o token", () async {
      // Servidor com defeito não invalida a credencial de ninguém.
      montar(tokenInicial: "jwt.bom");
      adaptador.falha(status: 500);

      await expectLater(repositorio.currentUser(), completion(isNull));
      expect(tokens.token, "jwt.bom");
    });
  });

  test("logout apaga o token", () async {
    montar(tokenInicial: "jwt.bom");

    await repositorio.logout();

    expect(tokens.token, isNull);
  });
}
