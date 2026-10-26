// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { SegredoDeWebhookGuard } from "./segredo-de-webhook.guard";

/**
 * **O guarda do webhook de pagamento (RNF-06, RNF-10).**
 *
 * Segunda porta do projeto aberta para fora, depois da ingestão de replay —
 * e a de **custo maior se cair**: quem passasse por aqui confirmaria reservas
 * sem pagar. O guarda da ingestão nasceu sem teste e ficou em 0% de ramos
 * até 14/10; este nasce com a suíte junto, que é a lição aplicada em vez de
 * repetida.
 */

const SEGREDO = "segredo-de-webhook-bem-comprido-para-o-teste";
const CABECALHO = "x-rally-webhook-secret";

function contexto(cabecalhos: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (nome: string) => cabecalhos[nome.toLowerCase()],
      }),
    }),
  } as unknown as ExecutionContext;
}

function guard(configurado: string | undefined) {
  return new SegredoDeWebhookGuard({
    get: jest.fn().mockReturnValue(configurado),
  } as unknown as ConfigService);
}

describe("SegredoDeWebhookGuard", () => {
  it("libera com o segredo correto", () => {
    expect(guard(SEGREDO).canActivate(contexto({ [CABECALHO]: SEGREDO }))).toBe(true);
  });

  it("recusa segredo errado do mesmo tamanho", () => {
    // Mesmo comprimento de propósito: se a comparação vazasse pelo tamanho,
    // este caso passaria e o seguinte não.
    const errado = "X" + SEGREDO.slice(1);
    expect(errado).toHaveLength(SEGREDO.length);

    expect(() => guard(SEGREDO).canActivate(contexto({ [CABECALHO]: errado }))).toThrow(
      UnauthorizedException,
    );
  });

  it("recusa segredo errado de tamanho diferente", () => {
    // `timingSafeEqual` **lança** com buffers de tamanhos diferentes. O hash
    // iguala o comprimento antes, e é por isso que este caso devolve 401 em
    // vez de 500 — sem ele o guarda quebraria com a entrada mais trivial.
    expect(() => guard(SEGREDO).canActivate(contexto({ [CABECALHO]: "curto" }))).toThrow(
      UnauthorizedException,
    );
  });

  it("recusa quando o cabeçalho não vem", () => {
    expect(() => guard(SEGREDO).canActivate(contexto({}))).toThrow(UnauthorizedException);
  });

  it("sem segredo configurado responde 503, e não 401", () => {
    // **A distinção é a decisão do arquivo.** 401 diria "seu segredo está
    // errado" quando o problema é o servidor não ter segredo nenhum — e o
    // fornecedor passaria o dia conferindo a própria configuração.
    expect(() => guard(undefined).canActivate(contexto({ [CABECALHO]: SEGREDO }))).toThrow(
      ServiceUnavailableException,
    );
  });

  it("sem segredo configurado **não libera**, mesmo sem cabeçalho nenhum", () => {
    // O erro oposto seria tratar "não configurado" como "não protegido" e
    // deixar passar. Aqui isso abriria a confirmação de pagamento para a
    // internet, que é o pior resultado possível deste arquivo.
    expect(() => guard(undefined).canActivate(contexto({}))).toThrow(ServiceUnavailableException);
    expect(() => guard("").canActivate(contexto({}))).toThrow(ServiceUnavailableException);
  });

  it("lê a variável que o `.env.example` documenta", () => {
    // Âncora contra renomear a variável de um lado só: o segredo ficaria
    // ausente, o guarda responderia 503 e pareceria "ambiente sem webhook"
    // em vez de "nome errado".
    const get = jest.fn().mockReturnValue(SEGREDO);
    new SegredoDeWebhookGuard({ get } as unknown as ConfigService).canActivate(
      contexto({ [CABECALHO]: SEGREDO }),
    );

    expect(get).toHaveBeenCalledWith("ABACATEPAY_WEBHOOK_SECRET");
  });
});
