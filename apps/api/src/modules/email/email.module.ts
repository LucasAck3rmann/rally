// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";

import { EmailDevProvider } from "./email-dev.provider";
import { EMAIL_PROVIDER } from "./email-provider";

/**
 * Canal de e-mail, em módulo próprio.
 *
 * Nasceu dentro de `notificacoes`, onde teve o primeiro consumidor. O segundo
 * — a recuperação de senha, em `auth` — revelou que ali não era o lugar:
 * `notificacoes` importa `auth` para proteger suas rotas, então `auth`
 * importar `notificacoes` de volta fecha um ciclo que o NestJS recusa a
 * resolver. O `app.module.spec.ts` acusou na primeira execução.
 *
 * Esta é a correção certa, e não um `forwardRef`: o envio de e-mail é
 * **infraestrutura**, não um detalhe de notificação. Num módulo que não
 * importa nada, qualquer um pode consumi-lo sem criar ciclo — que é
 * exatamente o que se espera de um adaptador de saída.
 *
 * Trocar o provedor de desenvolvimento pela mensageria da nuvem é substituir
 * este `useClass`, como já acontece no Pix.
 */
@Module({
  providers: [{ provide: EMAIL_PROVIDER, useClass: EmailDevProvider }],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
