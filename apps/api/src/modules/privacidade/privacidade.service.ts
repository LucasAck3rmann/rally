// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Role } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * Direitos do titular dos dados (RNF-07, LGPD).
 *
 * A Lei nº 13.709/2018 dá ao titular, entre outros, o direito de **acessar**
 * e de **eliminar** seus dados. O RNF-07 põe prazo: até quinze dias. Os dois
 * caminhos aqui são **imediatos**, o que atende o prazo com folga e dispensa
 * fila e acompanhamento — um pedido que se resolve na hora não precisa de
 * processo para garantir que não foi esquecido.
 */
@Injectable()
export class PrivacidadeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tudo o que o sistema guarda sobre quem pediu (art. 18, II e V).
   *
   * Em JSON e não em PDF: o direito aqui é de **portabilidade**, e o formato
   * precisa servir para outro sistema ler, não só para a pessoa olhar.
   *
   * As reservas trazem o nome da quadra e da arena porque sem eles o
   * histórico é uma lista de identificadores — exportar dado que ninguém
   * consegue interpretar cumpre a letra e perde o propósito.
   */
  async exportar(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        avatarUrl: true,
        consentLgpdEm: true,
        emailVerificadoEm: true,
        anonimizadoEm: true,
        createdAt: true,
        notifPref: {
          select: {
            canalWhatsapp: true,
            canalEmail: true,
            canalPush: true,
            marketingOptIn: true,
          },
        },
        memberships: {
          select: {
            role: true,
            estabelecimento: { select: { nome: true } },
          },
        },
        reservas: {
          select: {
            id: true,
            inicio: true,
            fim: true,
            status: true,
            preco: true,
            createdAt: true,
            canceladaEm: true,
            quadra: {
              select: {
                nome: true,
                estabelecimento: { select: { nome: true } },
              },
            },
            pagamento: {
              select: { status: true, metodo: true, valor: true, pagoEm: true },
            },
          },
          orderBy: { inicio: "desc" },
        },
        notificacoes: {
          select: { tipo: true, titulo: true, corpo: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!usuario) throw new NotFoundException("Usuário não encontrado.");

    return {
      geradoEm: new Date().toISOString(),
      // Dito no próprio arquivo: quem recebe a exportação precisa saber o que
      // não está nela, sem ter de perguntar.
      observacao:
        "Exportação dos dados pessoais mantidos pelo Rally. Não inclui " +
        "senha, que é guardada apenas como resumo criptográfico e não pode " +
        "ser recuperada, nem tokens de sessão.",
      conta: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        avatarUrl: usuario.avatarUrl,
        consentimentoLgpdEm: usuario.consentLgpdEm?.toISOString() ?? null,
        emailVerificadoEm: usuario.emailVerificadoEm?.toISOString() ?? null,
        anonimizadoEm: usuario.anonimizadoEm?.toISOString() ?? null,
        criadaEm: usuario.createdAt.toISOString(),
      },
      preferenciasDeAviso: usuario.notifPref,
      vinculos: usuario.memberships.map((m) => ({
        estabelecimento: m.estabelecimento.nome,
        papel: m.role,
      })),
      reservas: usuario.reservas.map((r) => ({
        id: r.id,
        arena: r.quadra.estabelecimento.nome,
        quadra: r.quadra.nome,
        inicio: r.inicio.toISOString(),
        fim: r.fim.toISOString(),
        status: r.status,
        preco: Number(r.preco),
        criadaEm: r.createdAt.toISOString(),
        canceladaEm: r.canceladaEm?.toISOString() ?? null,
        pagamento: r.pagamento && {
          status: r.pagamento.status,
          metodo: r.pagamento.metodo,
          valor: Number(r.pagamento.valor),
          pagoEm: r.pagamento.pagoEm?.toISOString() ?? null,
        },
      })),
      avisos: usuario.notificacoes.map((n) => ({
        tipo: n.tipo,
        titulo: n.titulo,
        corpo: n.corpo,
        em: n.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Elimina a conta por **anonimização**, e não por apagamento (art. 16).
   *
   * Apagar a linha levaria junto as reservas e os pagamentos, que o
   * estabelecimento precisa guardar por obrigação fiscal — e a própria lei
   * ressalva a conservação para cumprimento de obrigação legal. O que se
   * elimina é o que **identifica**: nome, e-mail, telefone, foto e a senha.
   * O histórico financeiro continua existindo, agora ligado a alguém que
   * não é mais ninguém.
   *
   * Sem senha, o login já recusa a conta — ele exige `senhaHash`. Os
   * vínculos de gestão caem junto, porque acesso a painel de arena não
   * sobrevive a uma conta eliminada.
   */
  async excluirConta(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, anonimizadoEm: true },
    });
    if (!usuario) throw new NotFoundException("Usuário não encontrado.");
    if (usuario.anonimizadoEm) {
      return { ok: true, anonimizadoEm: usuario.anonimizadoEm.toISOString() };
    }

    await this.garantirQueNenhumaArenaFicaSemAdmin(usuarioId);

    const agora = new Date();
    await this.prisma.$transaction(async (tx) => {
      // Tudo o que é pessoal e não é registro financeiro sai de vez.
      await tx.notificacao.deleteMany({ where: { usuarioId } });
      await tx.tokenDeSenha.deleteMany({ where: { usuarioId } });
      await tx.tokenDeEmail.deleteMany({ where: { usuarioId } });
      await tx.refreshToken.deleteMany({ where: { usuarioId } });
      await tx.account.deleteMany({ where: { usuarioId } });
      await tx.waitlistEntry.deleteMany({ where: { clienteId: usuarioId } });
      await tx.notificationPreference.deleteMany({ where: { usuarioId } });
      await tx.membership.deleteMany({ where: { usuarioId } });

      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          nome: "Usuário removido",
          // `.invalid` é o domínio que a RFC 2606 reserva para nunca
          // resolver: o endereço continua único, como a coluna exige, e
          // nenhuma mensagem sai dele por engano.
          email: `removido+${usuarioId}@rally.invalid`,
          telefone: null,
          avatarUrl: null,
          senhaHash: null,
          anonimizadoEm: agora,
        },
      });
    });

    return { ok: true, anonimizadoEm: agora.toISOString() };
  }

  /**
   * Recusa a eliminação enquanto a pessoa for a última administradora de
   * alguma arena.
   *
   * É a mesma regra que o módulo de equipe já protege ao trocar papel, e
   * pelo mesmo motivo: sem administrador, ninguém mais consegue gerir a
   * arena, e não há tela para desfazer porque a tela exige ser
   * administrador. A eliminação cairia por fora dessa trava se não fosse
   * conferida aqui.
   *
   * O direito de eliminação não é negado — fica condicionado a um ato que a
   * própria pessoa consegue fazer, e a recusa diz qual é.
   */
  private async garantirQueNenhumaArenaFicaSemAdmin(usuarioId: string) {
    const comoAdmin = await this.prisma.membership.findMany({
      where: { usuarioId, role: Role.ADMIN },
      select: { estabelecimentoId: true },
    });
    if (comoAdmin.length === 0) return;

    for (const { estabelecimentoId } of comoAdmin) {
      const outros = await this.prisma.membership.count({
        where: {
          estabelecimentoId,
          role: Role.ADMIN,
          usuarioId: { not: usuarioId },
        },
      });
      if (outros === 0) {
        const arena = await this.prisma.estabelecimento.findUnique({
          where: { id: estabelecimentoId },
          select: { nome: true },
        });
        throw new ConflictException(
          `Você é o único administrador de ${arena?.nome ?? "uma arena"}. ` +
            `Promova outra pessoa a administrador antes de excluir a conta.`,
        );
      }
    }
  }
}
