// SPDX-License-Identifier: AGPL-3.0-or-later
import { Equals, IsBoolean, IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;

  /**
   * Aceite da política de privacidade e dos termos (RNF-07, LGPD).
   *
   * Obrigatório e tem de ser `true`. A LGPD exige consentimento **livre,
   * informado e inequívoco** (art. 5º, XII), e campo opcional com padrão
   * verdadeiro é exatamente o contrário: registraria como aceite o silêncio
   * de quem nunca viu a política.
   *
   * `@Equals(true)` e não só `@IsBoolean()`: mandar `false` precisa ser
   * recusado, e não gravado como "consentiu que não".
   */
  @IsBoolean()
  @Equals(true, {
    message: "É preciso aceitar a política de privacidade para criar a conta.",
  })
  aceitouTermos!: boolean;
}
