// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hash } from "@node-rs/argon2";

import { PrismaService } from "../../prisma/prisma.service";
import { EMAIL_PROVIDER, EmailProvider } from "../email/email-provider";
import { hashDoToken, novoToken } from "./token-de-conta";

/** Quanto tempo o link vale. Curto porque chega por e-mail, que fica guardado. */
const VALIDADE_MINUTOS = 30;

/**
 * Recuperação de senha (RF-03).
 *
 * Duas regras atravessam o módulo inteiro:
 *
 * 1. **Nunca revelar se o e-mail existe.** `recuperar` responde a mesma coisa
 *    para endereço cadastrado e não cadastrado. É a mesma decisão já tomada
 *    na mensagem de erro do login, e pelo mesmo motivo: a diferença entre as
 *    duas respostas é uma lista de clientes da arena.
 * 2. **Nunca guardar o token.** O banco guarda o hash, como faz com a senha.
 *    Quem lesse a tabela poderia redefinir a senha de qualquer pessoa.
 */
@Injectable()
export class SenhaService {
  private readonly logger = new Logger(SenhaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /**
   * Começa a recuperação. Responde igual exista ou não o e-mail.
   *
   * O trabalho acontece depois da resposta ser decidida, e não antes: medir o
   * tempo de resposta não deve distinguir os dois casos. Por isso nada aqui
   * devolve erro — nem endereço inválido, nem falha de envio.
   */
  async recuperar(email: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, nome: true, email: true, anonimizadoEm: true },
    });

    // Conta anonimizada não recebe link: ela existe para preservar histórico
    // financeiro, não para voltar a ser usada.
    if (usuario && !usuario.anonimizadoEm) {
      await this.emitirToken(usuario.id, usuario.nome, usuario.email);
    }

    return {
      ok: true,
      mensagem:
        "Se houver conta com esse e-mail, o link de redefinição foi enviado.",
    };
  }

  private async emitirToken(usuarioId: string, nome: string, email: string) {
    try {
      const token = novoToken();

      // Invalida os pedidos anteriores: dois links válidos ao mesmo tempo
      // dobram a janela de quem interceptou o primeiro e nada ganham.
      await this.prisma.tokenDeSenha.updateMany({
        where: { usuarioId, usadoEm: null },
        data: { usadoEm: new Date() },
      });

      await this.prisma.tokenDeSenha.create({
        data: {
          usuarioId,
          tokenHash: hashDoToken(token),
          expiraEm: new Date(Date.now() + VALIDADE_MINUTOS * 60 * 1000),
        },
      });

      const base =
        this.config.get<string>("APP_URL") ?? "http://localhost:3000";
      const link = `${base}/redefinir-senha?token=${token}`;

      await this.email.enviar({
        para: email,
        assunto: "Redefinir sua senha no Rally",
        texto:
          `Olá, ${nome}.\n\n` +
          `Alguém pediu a redefinição da senha desta conta. Para escolher ` +
          `uma nova senha, abra o endereço abaixo:\n\n` +
          `${link}\n\n` +
          `O link vale por ${VALIDADE_MINUTOS} minutos e só pode ser usado ` +
          `uma vez.\n\n` +
          `Se não foi você, ignore esta mensagem: sua senha continua a mesma.`,
      });
    } catch (erro) {
      // Engolido de propósito: a resposta já foi decidida e precisa ser igual
      // nos dois casos. Propagar daqui transformaria uma falha de envio em
      // sinal de que o e-mail existe.
      this.logger.warn(`Falha ao emitir token de senha: ${erro}`);
    }
  }

  /**
   * Conclui a redefinição.
   *
   * Aqui a mensagem é específica, ao contrário de `recuperar`. Quem chega com
   * um token na mão já o recebeu por e-mail; dizer "esse link venceu" não
   * revela nada que a pessoa não saiba, e é o que a faz pedir outro em vez de
   * tentar de novo o mesmo.
   */
  async redefinir(token: string, novaSenha: string) {
    const registro = await this.prisma.tokenDeSenha.findUnique({
      where: { tokenHash: hashDoToken(token) },
      select: { id: true, usuarioId: true, expiraEm: true, usadoEm: true },
    });

    if (!registro) {
      throw new BadRequestException("Link inválido. Peça um novo.");
    }
    if (registro.usadoEm) {
      throw new BadRequestException("Esse link já foi usado. Peça um novo.");
    }
    if (registro.expiraEm < new Date()) {
      throw new BadRequestException("Esse link venceu. Peça um novo.");
    }

    // Marca o uso **antes** de trocar a senha, filtrando por `usadoEm: null`:
    // dois cliques simultâneos no mesmo link disputam esta escrita, e só uma
    // sai com `count: 1`. Sem isso, a senha seria trocada duas vezes e a
    // segunda venceria — inclusive a de quem interceptou o link.
    const { count } = await this.prisma.tokenDeSenha.updateMany({
      where: { id: registro.id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    if (count === 0) {
      throw new BadRequestException("Esse link já foi usado. Peça um novo.");
    }

    await this.prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { senhaHash: await hash(novaSenha) },
    });

    return { ok: true, mensagem: "Senha redefinida. Faça login com a nova." };
  }
}
