// SPDX-License-Identifier: AGPL-3.0-or-later
import { Role } from "@prisma/client";
import { IsEmail, IsEnum } from "class-validator";

/** Dá acesso de equipe a quem já tem conta no Rally (RF-23). */
export class AdicionarMembroDto {
  @IsEmail({}, { message: "Informe um e-mail válido." })
  email!: string;

  /**
   * `CLIENTE` e `MANTENEDOR` são aceitos pelo `@IsEnum` e recusados pelo
   * serviço, com mensagem própria: o primeiro é o vínculo de quem só joga,
   * o segundo é da plataforma. A validação de valor fica na borda; a de
   * **significado** fica onde a regra mora.
   */
  @IsEnum(Role, { message: "Papel desconhecido." })
  papel!: Role;
}

/** Troca o papel de alguém que já está na equipe. */
export class TrocarPapelDto {
  @IsEnum(Role, { message: "Papel desconhecido." })
  papel!: Role;
}
