// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/** Uma linha da trilha. */
export type Registro = {
  estabelecimentoId: string;
  /** Quem executou. Nulo só para ação de sistema, nunca para ação de pessoa. */
  autorId: string | null;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  /** O que foi enviado, já sem campo sensível. */
  dados?: Prisma.InputJsonValue;
};

/**
 * Trilha de auditoria das ações sensíveis de gestão (RN-05).
 *
 * **O que esta trilha responde é uma pergunta de delegação**, não de
 * depuração: o dono precisa poder dar acesso de balcão a alguém e depois
 * saber quem liberou aquele horário. É esse o argumento da §5.1 do relatório —
 * *"delegar a operação sem perder controle"* — e sem a escrita ele era uma
 * afirmação sobre um campo vazio.
 */
@Injectable()
export class AuditoriaService {
  private readonly log = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava uma linha da trilha.
   *
   * **Nunca propaga erro, e a escolha é deliberada.** A trilha é escrita
   * *depois* de a ação ter acontecido, de modo que uma falha aqui perde o
   * registro mas não desfaz nem bloqueia a operação. É o lado certo para
   * errar: recusar o cancelamento de uma reserva porque a linha de auditoria
   * não gravou transformaria um problema de registro num problema de
   * operação, e quem está no balcão com o cliente na frente não tem como
   * resolver isso.
   *
   * O preço é que a trilha é **de melhor esforço**, e isso precisa estar
   * declarado em vez de subentendido: ela pode ter buracos se o banco falhar
   * entre a ação e o registro. A alternativa estrita seria gravar na mesma
   * transação da mutação, o que daria a garantia de *nenhuma ação sem
   * registro* ao custo de bloquear a operação quando o registro falha.
   * Preferiu-se não bloquear, e a falha é registrada no log do servidor para
   * que o buraco não seja silencioso.
   */
  async registrar(registro: Registro): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          estabelecimentoId: registro.estabelecimentoId,
          autorId: registro.autorId,
          acao: registro.acao,
          entidade: registro.entidade,
          entidadeId: registro.entidadeId,
          dados: registro.dados,
        },
      });
    } catch (erro) {
      this.log.error(
        `Falha ao registrar na trilha: ${registro.acao} em ` +
          `${registro.entidade}${registro.entidadeId ? ` ${registro.entidadeId}` : ""} ` +
          `(estabelecimento ${registro.estabelecimentoId})`,
        erro instanceof Error ? erro.stack : undefined,
      );
    }
  }

  /**
   * A trilha de um estabelecimento, da mais recente para a mais antiga.
   *
   * `take` com teto porque a trilha cresce para sempre: é a única tabela do
   * projeto sem expurgo, por natureza — registro de auditoria que se apaga
   * não é registro de auditoria.
   */
  async listar(estabelecimentoId: string, limite = 100) {
    // **`NaN` atravessa o teto inteiro.** O controlador converte o parâmetro
    // da URL com `Number(...)`, e `Number("abc")` é `NaN`; daí
    // `Math.max(NaN, 1)` é `NaN` e `Math.min(NaN, 500)` também, de modo que
    // `?limite=abc` mandava `take: NaN` ao Prisma em vez de cair no padrão.
    // O teto protege contra número grande, não contra não-número.
    const pedido = Number.isFinite(limite) ? limite : 100;
    return this.prisma.auditLog.findMany({
      where: { estabelecimentoId },
      orderBy: { criadoEm: "desc" },
      take: Math.min(Math.max(pedido, 1), 500),
      select: {
        id: true,
        acao: true,
        entidade: true,
        entidadeId: true,
        dados: true,
        criadoEm: true,
        // Só o nome: a trilha é lida pelo dono, que precisa saber **quem** e
        // não o identificador interno de quem.
        autor: { select: { id: true, nome: true } },
      },
    });
  }
}
