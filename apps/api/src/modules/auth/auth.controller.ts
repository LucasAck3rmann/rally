// SPDX-License-Identifier: AGPL-3.0-or-later
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { SkipThrottle, Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { AuthService } from "./auth.service";
import { LIMITES } from "./limites";
import { CurrentUser } from "./decorators/current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RecuperarSenhaDto, RedefinirSenhaDto } from "./dto/senha.dto";
import { SenhaService } from "./senha.service";
import { VerificarEmailDto } from "./dto/verificar-email.dto";
import { VerificacaoDeEmailService } from "./verificacao-de-email.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtPayload } from "./types/jwt-payload";

/**
 * Rotas de autenticacao.
 *
 * O `ThrottlerGuard` vale para o controlador inteiro, e cada rota declara o
 * balde que a conta. Sem o guard no nivel da classe, o `@Throttle` de cada
 * metodo nao faria nada — e o decorador silencioso seria pior do que a
 * ausencia dele, porque pareceria protecao.
 *
 * **Rota sem declaracao nao fica sem limite: fica com todos.** Quando um
 * metodo nao traz `@Throttle`, o guard aplica os baldes do modulo, e o mais
 * apertado deles passa a valer. Foi o que aconteceu com o `GET /me`: uma
 * leitura da propria conta, atras do `JwtAuthGuard`, ficou presa ao balde de
 * **dez por minuto** desenhado para senha errada repetida. Medido nesta
 * maquina: a decima primeira leitura respondia 429 com `Retry-After-login`.
 *
 * O efeito aparecia longe daqui. A tela de privacidade da web chama `/me` a
 * cada carregamento, e as Server Actions saem todas do mesmo endereco — de
 * modo que **dez carregamentos por minuto, somando todos os usuarios**,
 * derrubavam a tela com erro de servidor. Por isso cada rota aqui declara
 * `@Throttle` **ou** `@SkipThrottle`, e o `limites.spec.ts` cobra isso: o
 * silencio e que era perigoso.
 */
/**
 * Isenta **todos** os baldes configurados, pelo nome.
 *
 * `@SkipThrottle()` sem argumento isenta apenas o balde chamado `default`, e
 * aqui nao existe nenhum com esse nome — os quatro tem nome proprio. Escrito
 * assim, o decorador parecia remover o limite e nao removia nada: medido, a
 * decima primeira leitura continuava respondendo 429 com o decorador no
 * lugar. E o inverso exato do que o docstring acima adverte sobre o
 * `@Throttle` sem o guard: decorador silencioso que parece protecao; este
 * parecia isencao.
 *
 * Os nomes saem do `LIMITES`, e nao de uma lista escrita a mao: balde novo
 * no modulo entra aqui sozinho, em vez de deixar esta isencao pela metade.
 */
const SEM_LIMITE = Object.fromEntries(LIMITES.throttlers.map((t) => [t.name, true]));

@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly senha: SenhaService,
    private readonly verificacao: VerificacaoDeEmailService,
  ) {}

  @Post("login")
  // **Este prazo é citado por extenso na tela.** A ação de entrar da web
  // traduz o 429 em "Aguarde um minuto e tente de novo", porque mandar
  // "tente de novo" é justamente o que não resolve. Mudar o `ttl` aqui sem
  // mudar a frase lá faria a tela prometer uma espera que não é a real.
  @Throttle({ login: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("register")
  @Throttle({ cadastro: { ttl: 60 * 60_000, limit: 20 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  /**
   * Pede o link de redefinicao (RF-03).
   *
   * Sem guarda: quem esqueceu a senha nao consegue autenticar. A resposta e
   * a mesma exista ou nao o e-mail — a diferenca entre as duas seria uma
   * lista de clientes da arena.
   */
  @Post("recuperar-senha")
  @Throttle({ recuperacao: { ttl: 15 * 60_000, limit: 10 } })
  recuperarSenha(@Body() dto: RecuperarSenhaDto) {
    return this.senha.recuperar(dto.email);
  }

  /** Conclui a redefinicao com o token recebido por e-mail (RF-03). */
  @Post("redefinir-senha")
  @Throttle({ token: { ttl: 60_000, limit: 20 } })
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.senha.redefinir(dto.token, dto.senha);
  }

  /**
   * Confirma o endereco de e-mail (RF-03).
   *
   * Sem guarda: o link e aberto no navegador, que nao tem a sessao do
   * aplicativo. O proprio token e a credencial.
   */
  @Post("verificar-email")
  @Throttle({ token: { ttl: 60_000, limit: 20 } })
  verificarEmail(@Body() dto: VerificarEmailDto) {
    return this.verificacao.confirmar(dto.token);
  }

  /**
   * A conta de quem esta pedindo.
   *
   * **Sem balde, e a ausencia e declarada.** Nao ha o que adivinhar aqui: a
   * rota exige token valido e devolve os dados de quem o apresentou. Nao e
   * tentativa de autenticacao nem amplificador de e-mail, que sao os dois
   * riscos que os baldes deste controlador existem para conter — e o resto
   * da API ja segue sem limite por decisao registrada no `app.module.ts`.
   *
   * O `@SkipThrottle` nao e descuido disfarcado de decisao: sem ele, esta
   * leitura herdava o balde de senha errada e derrubava a tela de
   * privacidade da web a cada dez carregamentos por minuto, somados todos os
   * usuarios.
   */
  @SkipThrottle(SEM_LIMITE)
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
