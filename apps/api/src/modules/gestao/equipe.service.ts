// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";

import { PAPEIS_DE_GESTAO } from "../auth/decorators/papeis.decorator";
import { PrismaService } from "../../prisma/prisma.service";

const MEMBRO = {
  id: true,
  role: true,
  createdAt: true,
  usuario: { select: { id: true, nome: true, email: true, avatarUrl: true } },
} satisfies Prisma.MembershipSelect;

type Membro = Prisma.MembershipGetPayload<{ select: typeof MEMBRO }>;

/**
 * Equipe do estabelecimento (RF-23).
 *
 * A **autorização** já existia desde o `PapelGuard`; o que faltava era
 * **gerenciar** quem tem qual papel. As duas coisas se encontram numa regra
 * que este serviço protege acima de tudo: **um estabelecimento nunca pode
 * ficar sem administrador**. Sem ela, um admin se rebaixa por engano e
 * tranca a arena inteira do lado de fora — e não há tela para desfazer,
 * porque a tela exige ser admin.
 */
@Injectable()
export class EquipeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quem trabalha aqui. O vínculo de cliente fica de fora. */
  async listar(estabelecimentoId: string) {
    const membros = await this.prisma.membership.findMany({
      where: { estabelecimentoId, role: { in: PAPEIS_DE_GESTAO } },
      select: MEMBRO,
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return membros.map((m) => this.paraDto(m));
  }

  /**
   * Dá acesso a alguém que já tem conta no Rally.
   *
   * Não cria usuário: convidar por e-mail quem ainda não se cadastrou
   * exigiria convite pendente, token e e-mail transacional — três coisas
   * que o MVP não tem. Quem não tem conta recebe **404 com o motivo**, e a
   * tela manda pedir o cadastro. Declarado, não escondido.
   */
  async adicionar(estabelecimentoId: string, email: string, papel: Role) {
    this.garantirPapelDeEquipe(papel);

    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!usuario) {
      throw new NotFoundException(
        "Ninguém com esse e-mail tem conta no Rally. Peça para se cadastrar primeiro.",
      );
    }

    const jaExiste = await this.prisma.membership.findUnique({
      where: {
        usuarioId_estabelecimentoId: {
          usuarioId: usuario.id,
          estabelecimentoId,
        },
      },
      select: { id: true, role: true },
    });

    // Quem já é cliente da arena vira equipe pelo mesmo vínculo: criar um
    // segundo esbarraria no índice único e, pior, daria dois papéis para a
    // mesma pessoa no mesmo lugar.
    if (jaExiste) {
      if (PAPEIS_DE_GESTAO.includes(jaExiste.role)) {
        throw new ConflictException("Essa pessoa já está na equipe.");
      }
      const atualizado = await this.prisma.membership.update({
        where: { id: jaExiste.id },
        data: { role: papel },
        select: MEMBRO,
      });
      return this.paraDto(atualizado);
    }

    const criado = await this.prisma.membership.create({
      data: { usuarioId: usuario.id, estabelecimentoId, role: papel },
      select: MEMBRO,
    });
    return this.paraDto(criado);
  }

  /** Troca o papel de alguém da equipe. */
  async trocarPapel(
    estabelecimentoId: string,
    usuarioId: string,
    papel: Role,
    quemPediu: string,
  ) {
    this.garantirPapelDeEquipe(papel);
    const vinculo = await this.daEquipe(estabelecimentoId, usuarioId);

    if (vinculo.role === Role.ADMIN && papel !== Role.ADMIN) {
      await this.garantirQueSobraAdmin(estabelecimentoId, usuarioId, quemPediu);
    }

    const atualizado = await this.prisma.membership.update({
      where: { id: vinculo.id },
      data: { role: papel },
      select: MEMBRO,
    });
    return this.paraDto(atualizado);
  }

  /**
   * Tira alguém da equipe.
   *
   * O vínculo vira `CLIENTE` em vez de sumir: a pessoa pode ter reservas
   * naquela arena, e apagar a linha derrubaria o histórico dela por causa
   * de uma mudança de cargo.
   */
  async remover(
    estabelecimentoId: string,
    usuarioId: string,
    quemPediu: string,
  ) {
    const vinculo = await this.daEquipe(estabelecimentoId, usuarioId);
    if (vinculo.role === Role.ADMIN) {
      await this.garantirQueSobraAdmin(estabelecimentoId, usuarioId, quemPediu);
    }

    await this.prisma.membership.update({
      where: { id: vinculo.id },
      data: { role: Role.CLIENTE },
    });
    return { usuarioId, removido: true };
  }

  /**
   * Impede que o estabelecimento fique sem administrador.
   *
   * A mensagem muda conforme quem pediu: rebaixar a si mesmo sendo o único
   * admin é o engano mais fácil de cometer e o mais caro de desfazer —
   * depois dele ninguém mais consegue abrir a tela que consertaria.
   */
  private async garantirQueSobraAdmin(
    estabelecimentoId: string,
    alvo: string,
    quemPediu: string,
  ) {
    const admins = await this.prisma.membership.count({
      where: { estabelecimentoId, role: Role.ADMIN },
    });
    if (admins > 1) return;

    throw new ForbiddenException(
      alvo === quemPediu
        ? "Você é o único administrador. Promova outra pessoa antes de sair."
        : "Esse é o único administrador. Promova outra pessoa antes de trocar o papel dele.",
    );
  }

  private async daEquipe(estabelecimentoId: string, usuarioId: string) {
    const vinculo = await this.prisma.membership.findUnique({
      where: {
        usuarioId_estabelecimentoId: { usuarioId, estabelecimentoId },
      },
      select: { id: true, role: true },
    });
    // Quem não tem vínculo e quem só é cliente dão o mesmo 404: a rota não
    // deve nem confirmar que a pessoa existe no sistema.
    if (!vinculo || !PAPEIS_DE_GESTAO.includes(vinculo.role)) {
      throw new NotFoundException("Essa pessoa não está na equipe.");
    }
    return vinculo;
  }

  /**
   * `CLIENTE` é o vínculo de quem só joga e `MANTENEDOR` é da plataforma —
   * nenhum dos dois se atribui por aqui. Sem esta checagem, um admin de
   * arena se promoveria a mantenedor e sairia do próprio tenant.
   */
  private garantirPapelDeEquipe(papel: Role) {
    if (!PAPEIS_DE_GESTAO.includes(papel)) {
      throw new BadRequestException(
        "Papel inválido para equipe: use ATENDENTE, FINANCEIRO ou ADMIN.",
      );
    }
  }

  private paraDto(m: Membro) {
    return {
      usuarioId: m.usuario.id,
      nome: m.usuario.nome,
      email: m.usuario.email,
      avatarUrl: m.usuario.avatarUrl,
      papel: m.role,
      desde: m.createdAt.toISOString(),
    };
  }
}
