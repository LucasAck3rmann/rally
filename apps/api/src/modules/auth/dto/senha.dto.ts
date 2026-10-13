// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

/** Pedido de link de redefinição (RF-03). */
export class RecuperarSenhaDto {
  @IsEmail({}, { message: "Informe um e-mail válido." })
  email!: string;
}

export class RedefinirSenhaDto {
  @IsString()
  @MinLength(10)
  token!: string;

  /**
   * Seis caracteres, que é o piso aplicado pelo `RegisterDto`.
   *
   * O número é baixo para o padrão atual — a OWASP recomenda oito —, mas
   * subi-lo só aqui criaria o pior dos dois mundos: senha aceita no cadastro
   * e recusada na redefinição da mesma conta. Mudar o piso é decisão de
   * política de senha, vale para os dois caminhos e não cabe junto de uma
   * entrega de recuperação.
   */
  @IsString()
  @MinLength(6, { message: "A senha precisa de ao menos 6 caracteres." })
  @MaxLength(128)
  senha!: string;
}
