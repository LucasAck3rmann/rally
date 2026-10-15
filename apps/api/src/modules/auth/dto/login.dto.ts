// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  senha!: string;
}
