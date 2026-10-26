// SPDX-License-Identifier: AGPL-3.0-or-later
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { Observable, tap } from "rxjs";

import { JwtPayload } from "../auth/types/jwt-payload";
import { ACAO_AUDITADA, DescricaoDaAcao } from "./auditar.decorator";
import { AuditoriaService } from "./auditoria.service";

/**
 * Campos que **nunca** entram na trilha.
 *
 * A trilha é lida pelo dono da arena, não pelo time de desenvolvimento, e
 * guardar o que está aqui transformaria um registro de governança num
 * vazamento: a senha nem deveria passar por aqui, e o e-mail de um convite é
 * dado pessoal de terceiro que a RN-05 não pede para registrar.
 */
const NUNCA_REGISTRAR = new Set([
  "senha",
  "senhaHash",
  "token",
  "tokenHash",
  "accessToken",
  "refreshToken",
  "pixCopiaCola",
  "email",
]);

/**
 * Escreve a trilha de auditoria das rotas marcadas com `@Auditar` (RN-05).
 *
 * **Só grava quando a ação deu certo.** `tap({ next })` e não `finalize`: uma
 * tentativa recusada pelo `PapelGuard` com 403, ou pela regra do último
 * administrador com 409, **não é uma ação sensível executada** — é uma ação
 * que não aconteceu. Registrá-la encheria a trilha de linhas que o dono leria
 * como "alguém fez isso", e o valor da trilha é justamente poder confiar no
 * que está nela.
 *
 * O autor vem do **token**, e o estabelecimento vem do **parâmetro da rota** —
 * os mesmos dois lugares de onde o `PapelGuard` tira a autorização. Ler o
 * autor do corpo da requisição permitiria a alguém assinar a ação com o nome
 * de outra pessoa, que é exatamente o oposto do que uma trilha serve.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    if (contexto.getType() !== "http") return proximo.handle();

    const descricao = this.reflector.getAllAndOverride<DescricaoDaAcao>(ACAO_AUDITADA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!descricao) return proximo.handle();

    const req = contexto
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload; params: Record<string, string> }>();
    const estabelecimentoId = req.params?.estabelecimentoId;
    // Sem estabelecimento não há trilha: o `AuditLog` é por inquilino, e uma
    // linha sem ele não teria onde aparecer.
    if (!estabelecimentoId) return proximo.handle();

    return proximo.handle().pipe(
      tap({
        next: () => {
          void this.auditoria.registrar({
            estabelecimentoId,
            autorId: req.user?.sub ?? null,
            acao: descricao.acao,
            entidade: descricao.entidade,
            entidadeId: descricao.parametro ? (req.params?.[descricao.parametro] ?? null) : null,
            dados: this.limpar(req.body),
          });
        },
      }),
    );
  }

  /**
   * O corpo da requisição sem os campos de {@link NUNCA_REGISTRAR}.
   *
   * Um nível só, de propósito: os corpos deste projeto são rasos, e uma
   * limpeza recursiva daria a impressão de garantia que ela não tem — campo
   * sensível aninhado numa estrutura nova passaria, e ninguém reconferiria.
   * Rasa e declarada é mais honesto que profunda e confiável por engano.
   */
  private limpar(corpo: unknown): Prisma.InputJsonValue | undefined {
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      return undefined;
    }
    const entradas = Object.entries(corpo as Record<string, unknown>).filter(
      ([chave]) => !NUNCA_REGISTRAR.has(chave),
    );
    return entradas.length > 0
      ? (Object.fromEntries(entradas) as Prisma.InputJsonValue)
      : undefined;
  }
}
