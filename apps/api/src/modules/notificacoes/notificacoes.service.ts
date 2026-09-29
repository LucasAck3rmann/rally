// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/** Avisos in-app do cliente (RF-16). O canal de e-mail ainda não existe. */
@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Registra um aviso.
   *
   * Engole o erro de propósito: a notificação é efeito colateral do que o
   * cliente pediu. Derrubar um pagamento já confirmado porque o aviso falhou
   * seria trocar um problema pequeno por um grave.
   */
  async registrar(dados: {
    usuarioId: string;
    tipo: NotificacaoTipo;
    titulo: string;
    corpo: string;
    destino?: string;
  }) {
    try {
      await this.prisma.notificacao.create({ data: dados });
    } catch (erro) {
      this.logger.warn(`Não foi possível registrar a notificação: ${erro}`);
    }
  }
}
