import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { AuthService } from "./auth.service";
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
 */
@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly senha: SenhaService,
    private readonly verificacao: VerificacaoDeEmailService,
  ) {}

  @Post("login")
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

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.me(user.sub);
  }
}
