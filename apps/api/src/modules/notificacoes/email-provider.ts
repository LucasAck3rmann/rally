// SPDX-License-Identifier: AGPL-3.0-or-later

/** Mensagem a entregar por e-mail. */
export interface Email {
  para: string;
  assunto: string;
  /** Corpo em texto puro. Sem HTML por ora: o que existe para dizer cabe
   *  em texto, e HTML traria renderização a testar em cada cliente. */
  texto: string;
}

/**
 * Porta de envio de e-mail (RF-16).
 *
 * Mesma forma da {@link PixProvider}: o domínio fala com a porta, e qual
 * serviço entrega a mensagem é decisão de infraestrutura. Em
 * desenvolvimento quem responde é o {@link EmailDevProvider}, que registra
 * no log em vez de enviar; em produção entra o serviço de mensageria da
 * nuvem, cuja contratação é o marco M5.
 *
 * O ganho de ter a porta agora, antes de existir credencial: o **conteúdo**
 * de cada aviso — quem recebe, com que assunto, dizendo o quê — fica
 * escrito e testado. Quando a credencial chegar, o que falta é uma classe
 * de dez linhas e uma troca de `useClass`, não decidir o que o e-mail diz.
 */
export interface EmailProvider {
  enviar(email: Email): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
