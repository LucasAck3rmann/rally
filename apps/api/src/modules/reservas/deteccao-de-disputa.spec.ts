// SPDX-License-Identifier: AGPL-3.0-or-later
import { Prisma } from "@prisma/client";

import { ehConflitoDeHorario, ehImpasseDeHorario } from "./reservas.service";

/**
 * As duas formas de perder a disputa por um horário, e por que elas não são a
 * mesma coisa (RN-01, RNF-03).
 *
 * **As mensagens aqui são medidas, não inventadas.** Foram copiadas do que o
 * PostgreSQL 18 desta máquina devolveu em 22/10/2026, pelo portão de carga do
 * RNF-03 e por uma sonda que insistiu na corrida até capturar o impasse. A
 * suíte de integração do mensalista já registra por quê isso importa: um
 * detector escrito contra a frase que o programador imagina passa no teste de
 * unidade e falha calado contra o banco de verdade.
 *
 * O que esta suíte acrescenta é o inverso — as integrações só rodam com
 * `DATABASE_URL`, e sem banco o detector não era exercitado por nada.
 */

/** Prefixo que o Prisma põe antes do erro do banco, encurtado. */
const MOLDURA =
  "\nInvalid `prisma.reserva.create()` invocation in\n" +
  "/app/src/modules/reservas/reservas.service.ts:231:35\n\n" +
  "Error occurred during query execution:\n";

/** Violação da restrição de exclusão, como o servidor em português a devolve. */
const VIOLACAO_EXCLUSAO =
  MOLDURA +
  'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "23P01", ' +
  'message: "valor-chave conflitante viola a restrição de exclusão \\"reserva_sem_sobreposicao\\"", ' +
  'severity: "ERRO", detail: Some("A chave (\\"quadraId\\", tsrange(inicio, fim))=(cmv1, ' +
  '[\\"2030-03-01 19:00:00\\",\\"2030-03-01 20:00:00\\")) está em conflito com a chave existente."), ' +
  "column: None, hint: None }), transient: false })";

/** Impasse, como o servidor em português o devolve. */
const IMPASSE_PT =
  MOLDURA +
  'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", ' +
  'message: "impasse detectado", severity: "ERRO", ' +
  'detail: Some("Processo 16268 espera por ShareLock em transação 7072; bloqueado pelo processo 33392.\\n' +
  'Processo 33392 espera por ShareLock em transação 7070; bloqueado pelo processo 16268."), ' +
  'column: None, hint: Some("Veja log do servidor para obter detalhes das consultas.") }), transient: false })';

/** O mesmo impasse num servidor em inglês, que é a maioria em produção. */
const IMPASSE_EN =
  MOLDURA +
  'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "40P01", ' +
  'message: "deadlock detected", severity: "ERROR", ' +
  'detail: Some("Process 16268 waits for ShareLock on transaction 7072; blocked by process 33392."), ' +
  'column: None, hint: Some("See server log for query details.") }), transient: false })';

/** O Prisma entrega os dois como erro desconhecido, sem `code` próprio. */
function comoOPrismaEntrega(mensagem: string) {
  return new Prisma.PrismaClientUnknownRequestError(mensagem, {
    clientVersion: "6.19.3",
  });
}

describe("ehConflitoDeHorario — o horário está provadamente ocupado", () => {
  it("reconhece a violação da restrição de exclusão pelo nome dela", () => {
    expect(ehConflitoDeHorario(comoOPrismaEntrega(VIOLACAO_EXCLUSAO))).toBe(true);
  });

  it("reconhece o P2002, para banco que não recebeu a migração da constraint", () => {
    const erro = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    expect(ehConflitoDeHorario(erro)).toBe(true);
  });

  /**
   * **O ponto desta suíte.** O mensalista decide pular a semana olhando este
   * predicado, e registra o motivo *"o horário já estava ocupado nessa
   * semana"*. Impasse não sustenta essa afirmação: a transação foi abortada
   * para desfazer um ciclo de espera, e o intervalo pode estar livre. Aceitar
   * impasse aqui faria o sistema registrar como ocupada uma semana que não
   * está, e seguir adiante sem erro.
   */
  it("não aceita impasse, que não prova ocupação", () => {
    expect(ehConflitoDeHorario(comoOPrismaEntrega(IMPASSE_PT))).toBe(false);
    expect(ehConflitoDeHorario(comoOPrismaEntrega(IMPASSE_EN))).toBe(false);
  });

  it("não aceita erro alheio", () => {
    expect(ehConflitoDeHorario(new Error("connection terminated"))).toBe(false);
    expect(ehConflitoDeHorario(undefined)).toBe(false);
  });
});

describe("ehImpasseDeHorario — a transação perdeu a disputa", () => {
  /**
   * O discriminador é o SQLSTATE, e é por isso que os dois idiomas passam. A
   * mensagem do servidor vem na língua dele, e um detector escrito contra
   * *"deadlock detected"* não reconheceria nada nesta máquina, onde o
   * PostgreSQL responde *"impasse detectado"*.
   */
  it("reconhece o 40P01 em qualquer idioma de servidor", () => {
    expect(ehImpasseDeHorario(comoOPrismaEntrega(IMPASSE_PT))).toBe(true);
    expect(ehImpasseDeHorario(comoOPrismaEntrega(IMPASSE_EN))).toBe(true);
  });

  it("não confunde impasse com violação da restrição", () => {
    expect(ehImpasseDeHorario(comoOPrismaEntrega(VIOLACAO_EXCLUSAO))).toBe(false);
  });

  it("não aceita erro alheio", () => {
    expect(ehImpasseDeHorario(new Error("connection terminated"))).toBe(false);
    expect(ehImpasseDeHorario(null)).toBe(false);
  });

  /**
   * `40P01` tem de ser lido como código, e não como pedaço de texto: a busca
   * é delimitada por fronteira de palavra, para que um identificador que
   * contenha a sequência não seja confundido com o código do erro.
   */
  it("não dispara com a sequência embutida noutro identificador", () => {
    expect(
      ehImpasseDeHorario(new Error('gatewayId: "cob40P01x" não encontrado')),
    ).toBe(false);
  });
});
