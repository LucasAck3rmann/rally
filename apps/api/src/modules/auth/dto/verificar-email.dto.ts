// SPDX-License-Identifier: AGPL-3.0-or-later
import { IsString, MinLength } from "class-validator";

/** Confirmacao de endereco de e-mail (RF-03). */
export class VerificarEmailDto {
  @IsString()
  @MinLength(10)
  token!: string;
}
