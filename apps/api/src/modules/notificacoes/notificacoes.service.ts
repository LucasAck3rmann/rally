// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { EMAIL_PROVIDER, EmailProvider } from "../email/email-provider";

/**
 * Avisos do cliente (RF-16), em dois canais.
 *
 * O **in-app** é o canal principal e sempre acontece. O **e-mail** é opcional
 * por aviso, e quem decide é quem chama: "seu pagamento foi confirmado" vale
 * uma mensagem na caixa de entrada, "seu replay está pronto" também, e um
 * aviso que só faz sentido dentro do aplicativo não precisa sair dele.
 */
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /** Lista para a tela, com a contagem de não lidas para o selo do sino. */
  async minhas(usuarioId: string) {
    const [itens, naoLidas] = await this.prisma.$transaction([
      this.prisma.notificacao.findMany({
        where: { usuarioId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notificacao.count({ where: { usuarioId, lidaEm: null } }),
    ]);

    return {
      naoLidas,
      itens: itens.map((n) => ({
        id: n.id,
        tipo: n.tipo,
        titulo: n.titulo,
        corpo: n.corpo,
        destino: n.destino,
        lida: n.lidaEm !== null,
        criadaEm: n.createdAt.toISOString(),
      })),
    };
  }

  async marcarLida(id: string, usuarioId: string) {
    // O dono entra no filtro do próprio update: quem não é dono não encontra
    // nada, e a notificação de outro cliente nunca é tocada nem revelada.
    const { count } = await this.prisma.notificacao.updateMany({
      where: { id, usuarioId, lidaEm: null },
      data: { lidaEm: new Date() },
    });

    if (count === 0) {
      const existe = await this.prisma.notificacao.count({
        where: { id, usuarioId },
      });
      if (existe === 0) {
        throw new NotFoundException("Notificação não encontrada.");
      }
    }
    return { ok: true };
  }

  async lerTodas(usuarioId: string) {
    const { count } = await this.prisma.notificacao.updateMany({
      where: { usuarioId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    return { marcadas: count };
  }

  /**
   * Registra um aviso, e opcionalmente o manda também por e-mail.
   *
   * Engole o erro de propósito: a notificação é efeito colateral do que o
   * cliente pediu. Derrubar um pagamento já confirmado porque o aviso falhou
   * seria trocar um problema pequeno por um grave.
   *
   * Os dois canais têm `try` **separados**. Com um só, uma falha ao gravar
   * o aviso in-app engoliria junto o e-mail, e o cliente ficaria sem nenhum
   * dos dois — quando o certo é ficar sem o que falhou.
   */
  async registrar(dados: {
    usuarioId: string;
    tipo: NotificacaoTipo;
    titulo: string;
    corpo: string;
    destino?: string;
    /** Presente, o mesmo aviso também sai por e-mail. */
    email?: { assunto: string; texto: string };
  }) {
    const { email, ...notificacao } = dados;

    try {
      await this.prisma.notificacao.create({ data: notificacao });
    } catch (erro) {
      this.logger.warn(`Não foi possível registrar a notificação: ${erro}`);
    }

    if (!email) return;
    try {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: dados.usuarioId },
        select: { email: true },
      });
      // Sem endereço não há o que tentar, e tentar registraria um erro que
      // não é erro: o aviso in-app já chegou.
      if (!usuario?.email) return;

      await this.email.enviar({
        para: usuario.email,
        assunto: email.assunto,
        texto: email.texto,
      });
    } catch (erro) {
      this.logger.warn(`Não foi possível enviar o e-mail do aviso: ${erro}`);
    }
  }
}
