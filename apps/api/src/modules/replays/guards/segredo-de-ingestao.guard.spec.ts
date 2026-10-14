// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { SegredoDeIngestaoGuard } from "./segredo-de-ingestao.guard";

/**
 * **O guarda da ingestão de replay (RNF-06).**
 *
 * Estava em 38% de instruções e 0% de ramos — e é a única porta do projeto
 * aberta para **fora**, chamada por máquina do parceiro de captação e não por
 * usuário. O Dossiê de Defesa Técnica apresenta duas decisões deste arquivo
 * como justificativas técnicas: o segredo compartilhado em vez de JWT, e a
 * comparação em tempo constante. Decisão exibida na banca sem teste por trás
 * é afirmação, e é exatamente o que esta suíte converte em medida.
 */

const SEGREDO = "segredo-de-ingestao-bem-comprido-para-o-teste";

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
  return new SegredoDeIngestaoGuard({
    get: jest.fn().mockReturnValue(configurado),
  } as unknown as ConfigService);
}

describe("SegredoDeIngestaoGuard", () => {
  it("libera com o segredo correto", () => {
    expect(
      guard(SEGREDO).canActivate(contexto({ "x-rally-ingest-secret": SEGREDO })),
    ).toBe(true);
  });

  it("recusa segredo errado do mesmo tamanho", () => {
    // Mesmo comprimento de propósito: se a comparação vazasse pelo tamanho,
    // este caso passaria e o seguinte não.
    const errado = "X" + SEGREDO.slice(1);
    expect(errado).toHaveLength(SEGREDO.length);

    expect(() =>
      guard(SEGREDO).canActivate(contexto({ "x-rally-ingest-secret": errado })),
    ).toThrow(UnauthorizedException);
  });

  it("recusa segredo errado de outro tamanho, sem estourar", () => {
    // `timingSafeEqual` **lança** quando os buffers têm tamanhos diferentes.
    // É por isso que o guarda compara os resumos: eles têm sempre 32 bytes.
    // Sem o hash, um segredo de tamanho diferente viraria erro 500 em vez de
    // 401 — e o 500 já contaria ao atacante que o tamanho dele está errado.
    expect(() =>
      guard(SEGREDO).canActivate(contexto({ "x-rally-ingest-secret": "curto" })),
    ).toThrow(UnauthorizedException);
  });

  it("recusa com prefixo correto, que é o caso que o tempo constante protege", () => {
    // Acertar os primeiros caracteres não pode custar mais tempo que errar
    // o primeiro. O teste não mede tempo — medir isso de forma estável num
    // teste unitário não é viável —, mas prende o comportamento: prefixo
    // correto é recusa igual a qualquer outra.
    expect(() =>
      guard(SEGREDO).canActivate(
        contexto({ "x-rally-ingest-secret": SEGREDO.slice(0, -1) + "Z" }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it("recusa sem o cabeçalho", () => {
    expect(() => guard(SEGREDO).canActivate(contexto({}))).toThrow(
      UnauthorizedException,
    );
  });

  it("recusa cabeçalho vazio, em vez de compará-lo", () => {
    // String vazia é falsy: a guarda sai antes do `iguais`. Se não saísse,
    // compararia o resumo de "" com o do segredo — recusaria igual, mas por
    // caminho mais longo e sem dizer o motivo certo.
    expect(() =>
      guard(SEGREDO).canActivate(contexto({ "x-rally-ingest-secret": "" })),
    ).toThrow(UnauthorizedException);
  });

  it("sem segredo configurado responde 503, e não 401", () => {
    // A diferença importa e está comentada no guarda: 401 diria "seu segredo
    // está errado" quando o problema é que o servidor não tem segredo nenhum.
    expect(() =>
      guard(undefined).canActivate(contexto({ "x-rally-ingest-secret": "qualquer" })),
    ).toThrow(ServiceUnavailableException);
  });

  it("segredo vazio na configuração também é 503", () => {
    // `REPLAY_INGEST_SECRET=` num `.env` dá string vazia. Tratá-la como
    // configurada abriria a ingestão para quem mandasse o cabeçalho vazio.
    expect(() =>
      guard("").canActivate(contexto({ "x-rally-ingest-secret": "" })),
    ).toThrow(ServiceUnavailableException);
  });

  it("a recusa não devolve o segredo esperado nem parte dele", () => {
    const mensagem = (() => {
      try {
        guard(SEGREDO).canActivate(contexto({ "x-rally-ingest-secret": "errado" }));
        return "";
      } catch (erro) {
        return (erro as Error).message;
      }
    })();

    expect(mensagem).not.toContain(SEGREDO);
    expect(mensagem).not.toContain(SEGREDO.slice(0, 8));
  });
});
