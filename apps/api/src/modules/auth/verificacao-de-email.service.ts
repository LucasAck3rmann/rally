// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "../../prisma/prisma.service";
import { EMAIL_PROVIDER, EmailProvider } from "../email/email-provider";
import { hashDoToken, novoToken } from "./token-de-conta";

/**
 * Sete dias, e não os trinta minutos do token de senha.
 *
 * A diferença é de consequência. O link de senha **troca uma credencial**, e
 * uma janela curta limita o estrago de um e-mail que vazou. Este só
 * **confirma um fato** que já era verdade no cadastro; expirá-lo em meia
 * hora criaria uma fila de suporte para quem abriu a caixa de entrada no dia
 * seguinte, sem nada em troca.
 */
const VALIDADE_DIAS = 7;

/**
 * Verificação de endereço de e-mail (RF-03).
 *
 * O cadastro **não** espera a verificação para liberar a conta. Quem acabou
 * de se cadastrar quer reservar uma quadra, e bloquear a sessão até alguém
 * abrir a caixa de entrada troca uma garantia pequena por um abandono
 * grande. O que a verificação entrega é o fato registrado — e é dele que
 * dependem os avisos por e-mail valerem a pena.
 */
@Injectable()
export class VerificacaoDeEmailService {
  private readonly logger = new Logger(VerificacaoDeEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /**
   * Emite e envia o link de verificação.
   *
   * Nunca propaga erro: é chamada logo depois do cadastro, e derrubar a
   * criação da conta porque o e-mail não saiu seria trocar um problema
   * pequeno por um grave — a pessoa ficaria sem conta e sem entender por quê.
   */
  async enviar(usuarioId: string, nome: string, email: string): Promise<void> {
    try {
      const token = novoToken();

      // Invalida os anteriores: dois links válidos ao mesmo tempo não
      // verificam nada a mais e dobram a janela de quem interceptou um.
      await this.prisma.tokenDeEmail.updateMany({
        where: { usuarioId, usadoEm: null },
        data: { usadoEm: new Date() },
      });

      await this.prisma.tokenDeEmail.create({
        data: {
          usuarioId,
          tokenHash: hashDoToken(token),
          expiraEm: new Date(Date.now() + VALIDADE_DIAS * 24 * 60 * 60 * 1000),
        },
      });

      const base = this.config.get<string>("APP_URL") ?? "http://localhost:3000";
      await this.email.enviar({
        para: email,
        assunto: "Confirme seu e-mail no Rally",
        texto:
          `Olá, ${nome}.\n\n` +
          `Confirme que este endereço é seu para receber os avisos das suas ` +
          `reservas:\n\n` +
          `${base}/confirmar-email?token=${token}\n\n` +
          `O link vale por ${VALIDADE_DIAS} dias. Sua conta já está ativa — ` +
          `isto serve só para garantirmos que os avisos chegam.`,
      });
    } catch (erro) {
      this.logger.warn(`Falha ao enviar verificação de e-mail: ${erro}`);
    }
  }

  /** Confirma o endereço a partir do token recebido por e-mail. */
  async confirmar(token: string) {
    const registro = await this.prisma.tokenDeEmail.findUnique({
      where: { tokenHash: hashDoToken(token) },
      select: { id: true, usuarioId: true, expiraEm: true, usadoEm: true },
    });

    if (!registro) {
      throw new BadRequestException("Link inválido. Peça outro.");
    }
    if (registro.usadoEm) {
      // Não é erro de verdade, e a mensagem diz isso: quem clica duas vezes
      // no mesmo link — o que acontece — já tem o endereço confirmado.
      return { ok: true, jaConfirmado: true };
    }
    if (registro.expiraEm < new Date()) {
      throw new BadRequestException("Esse link venceu. Peça outro.");
    }

    // Marca o uso filtrando por não usado, como na senha: dois cliques
    // simultâneos disputam esta escrita e só um a vence.
    const { count } = await this.prisma.tokenDeEmail.updateMany({
      where: { id: registro.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    if (count === 0) return { ok: true, jaConfirmado: true };

    await this.prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { emailVerificadoEm: new Date() },
    });

    return { ok: true, jaConfirmado: false };
  }
}
