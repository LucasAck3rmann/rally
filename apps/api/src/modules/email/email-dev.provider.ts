// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger } from "@nestjs/common";

import { Email, EmailProvider } from "./email-provider";

/**
 * Provedor de e-mail **de desenvolvimento**: registra no log em vez de
 * enviar.
 *
 * Registra o corpo inteiro de propósito. É o que permite conferir, em
 * desenvolvimento, o que o cliente receberia — inclusive o link de
 * recuperação de senha, que não tem outro caminho até a caixa de entrada
 * enquanto não houver mensageria.
 *
 * Em produção isto é substituído, e **precisa** ser: um log com corpo de
 * e-mail é informação pessoal onde ela não deveria estar.
 */
@Injectable()
export class EmailDevProvider implements EmailProvider {
  private readonly logger = new Logger(EmailDevProvider.name);

  async enviar(email: Email): Promise<void> {
    this.logger.warn(
      `E-mail simulado (sem mensageria) para ${email.para}\n` +
        `Assunto: ${email.assunto}\n${email.texto}`,
    );
  }
}
