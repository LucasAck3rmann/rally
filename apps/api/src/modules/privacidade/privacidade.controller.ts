// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Delete, Get, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JwtPayload } from "../auth/types/jwt-payload";
import { PrivacidadeService } from "./privacidade.service";

/**
 * Direitos do titular dos dados (RNF-07, LGPD).
 *
 * As duas rotas agem **sobre quem esta autenticado**, e o identificado vem
 * do token e nunca da URL. Nao ha, e nao deve haver, rota para exportar ou
 * excluir a conta de outra pessoa: seria a mesma falha de referencia direta
 * que o ADR-0011 manda evitar, agora sobre dado pessoal.
 */
@Controller("privacidade")
@UseGuards(JwtAuthGuard)
export class PrivacidadeController {
  constructor(private readonly privacidade: PrivacidadeService) {}

  /** Exportacao dos dados pessoais, em JSON (portabilidade). */
  @Get("meus-dados")
  meusDados(@CurrentUser() usuario: JwtPayload) {
    return this.privacidade.exportar(usuario.sub);
  }

  /**
   * Elimina a conta por anonimizacao.
   *
   * `DELETE` e nao `POST`: o verbo diz o que acontece, e quem le o registro
   * do servidor entende sem abrir o corpo da requisicao.
   */
  @Delete("minha-conta")
  excluirConta(@CurrentUser() usuario: JwtPayload) {
    return this.privacidade.excluirConta(usuario.sub);
  }
}
