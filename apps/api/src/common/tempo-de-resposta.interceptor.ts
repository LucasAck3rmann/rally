// SPDX-License-Identifier: AGPL-3.0-or-later
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";

import { Latencia } from "./latencia";

/**
 * Mede quanto a API levou para responder cada requisição (RNF-01).
 *
 * A chave é o **padrão da rota** (`/quadras/:id`), e não o caminho pedido
 * (`/quadras/clx123`). Sem isso, cada identificador viraria uma rota
 * diferente no resumo, a memória cresceria sem teto e o p95 por rota
 * deixaria de existir — seria sempre uma amostra de tamanho um.
 *
 * `tap` e não `finalize`: interessa o tempo da resposta que o cliente
 * recebeu. Uma requisição cancelada no meio não é uma resposta lenta, e
 * contá-la sujaria a medida com algo que o servidor não controla.
 */
@Injectable()
export class TempoDeRespostaInterceptor implements NestInterceptor {
  constructor(private readonly latencia: Latencia) {}

  intercept(contexto: ExecutionContext, proximo: CallHandler): Observable<unknown> {
    if (contexto.getType() !== "http") return proximo.handle();

    const req = contexto.switchToHttp().getRequest<Request>();
    const comecou = process.hrtime.bigint();

    return proximo.handle().pipe(
      tap({
        next: () => this.anotar(req, comecou),
        // O erro também entra: uma rota que falha devagar é um problema de
        // desempenho, e deixá-la fora faria o p95 parecer melhor do que é.
        error: () => this.anotar(req, comecou),
      }),
    );
  }

  private anotar(req: Request, comecou: bigint): void {
    const ms = Number(process.hrtime.bigint() - comecou) / 1_000_000;
    const padrao = (req.route as { path?: string } | undefined)?.path;
    const base = (req.baseUrl ?? "").replace(/\/$/, "");
    this.latencia.registrar(`${req.method} ${base}${padrao ?? req.path}`, ms);
  }
}
