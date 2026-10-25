// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZodTypeAny } from "zod";

import {
  AgendaDoDia,
  Conciliacao,
  ListaDaEquipe,
  ListaDeCupons,
  ListaDeEstabelecimentos,
  ListaDeMensalistas,
  ListaDeQuadras,
  Painel,
  Relatorio,
  TrilhaDeAuditoria,
} from "./contratos";
import {
  agendaDoDia,
  conciliacaoDoEstabelecimento,
  cuponsDoEstabelecimento,
  equipeDoEstabelecimento,
  mensalistasDoEstabelecimento,
  meuPapelEm,
  meusEstabelecimentos,
  painelDoEstabelecimento,
  quadrasDoEstabelecimento,
  relatorioDoPeriodo,
  trilhaDoEstabelecimento,
} from "./consultas";

const chamar = vi.fn();
vi.mock("../api/autenticado", () => ({
  chamarApiAutenticada: (caminho: string, schema: ZodTypeAny, opcoes?: unknown) =>
    chamar(caminho, schema, opcoes),
}));

/**
 * **As doze leituras do painel de gestão.**
 *
 * O arquivo estava em **0%**: doze funções, nenhuma chamada por teste algum.
 * Não é lógica — cada uma é um par **caminho + contrato** —, e é exatamente
 * por isso que vale fixá-las. O defeito que mora aqui não é ramo não
 * percorrido, é **par trocado**: validar a agenda com o esquema do painel, ou
 * pedir os cupons na rota da equipe. As duas coisas compilam, porque o tipo
 * do esquema não fala do caminho, e o sintoma aparece como "resposta fora do
 * contrato" numa tela que não é a do erro.
 *
 * Por isso o teste é tabela de correspondência e não de tamanho: ele afirma
 * *qual* esquema vai com *qual* rota, comparando o esquema pela identidade do
 * objeto importado do `contratos.ts`. Trocar dois nomes de lugar no
 * `consultas.ts` reprova.
 *
 * Duas decisões de verdade moram aqui e ganham teste próprio: o `meuPapelEm`,
 * que devolve `null` em vez de estourar quando o usuário não tem vínculo — é
 * o que a tela usa para decidir entre esconder um botão e mostrar 403 —, e o
 * teto de `limite` da trilha, que a tela pede em 100.
 */

const ID = "e1";

beforeEach(() => {
  chamar.mockReset().mockResolvedValue([]);
});

describe("o par caminho/contrato de cada leitura", () => {
  const tabela: ReadonlyArray<[string, () => unknown, string, ZodTypeAny, unknown]> = [
    [
      "painel",
      () => painelDoEstabelecimento(ID, 30),
      `/gestao/estabelecimentos/${ID}/painel`,
      Painel,
      { parametros: { dias: 30 } },
    ],
    [
      "agenda do dia",
      () => agendaDoDia(ID, "2026-10-25"),
      `/gestao/estabelecimentos/${ID}/agenda`,
      AgendaDoDia,
      { parametros: { data: "2026-10-25" } },
    ],
    [
      "quadras",
      () => quadrasDoEstabelecimento(ID),
      `/gestao/estabelecimentos/${ID}/quadras`,
      ListaDeQuadras,
      undefined,
    ],
    [
      "cupons",
      () => cuponsDoEstabelecimento(ID),
      `/gestao/estabelecimentos/${ID}/cupons`,
      ListaDeCupons,
      undefined,
    ],
    [
      "equipe",
      () => equipeDoEstabelecimento(ID),
      `/gestao/estabelecimentos/${ID}/equipe`,
      ListaDaEquipe,
      undefined,
    ],
    [
      "relatório do período",
      () => relatorioDoPeriodo(ID, "2026-10-01", "2026-10-31"),
      `/gestao/estabelecimentos/${ID}/relatorios`,
      Relatorio,
      { parametros: { de: "2026-10-01", ate: "2026-10-31" } },
    ],
    [
      "conciliação",
      () => conciliacaoDoEstabelecimento(ID),
      `/gestao/estabelecimentos/${ID}/conciliacao`,
      Conciliacao,
      undefined,
    ],
    [
      "trilha de auditoria",
      () => trilhaDoEstabelecimento(ID, 100),
      `/gestao/estabelecimentos/${ID}/auditoria`,
      TrilhaDeAuditoria,
      { parametros: { limite: 100 } },
    ],
    [
      "mensalistas",
      () => mensalistasDoEstabelecimento(ID),
      `/gestao/estabelecimentos/${ID}/mensalistas`,
      ListaDeMensalistas,
      undefined,
    ],
  ];

  it.each(tabela)("%s", async (_nome, ler, caminho, schema, opcoes) => {
    await ler();

    expect(chamar).toHaveBeenCalledTimes(1);
    const [caminhoUsado, schemaUsado, opcoesUsadas] = chamar.mock.calls[0];
    expect(caminhoUsado).toBe(caminho);
    // Identidade, e não forma: dois esquemas Zod diferentes podem ter a mesma
    // estrutura, e o que se quer fixar é que **este** contrato é o desta rota.
    expect(schemaUsado).toBe(schema);
    expect(opcoesUsadas).toEqual(opcoes);
  });

  it("os estabelecimentos do usuário vêm da rota sem identificador", async () => {
    // Fica fora da tabela porque é a única que não é por estabelecimento: é
    // ela que **descobre** quais existem, e alimenta o seletor da barra
    // lateral e a decisão de quais botões a página mostra.
    await meusEstabelecimentos();

    const [caminho, schema] = chamar.mock.calls[0];
    expect(caminho).toBe("/gestao/estabelecimentos");
    expect(schema).toBe(ListaDeEstabelecimentos);
  });
});

describe("meuPapelEm", () => {
  it("devolve o papel do usuário no estabelecimento pedido", async () => {
    chamar.mockResolvedValue([
      { id: "e1", meuPapel: "ATENDENTE" },
      { id: "e2", meuPapel: "ADMIN" },
    ]);

    await expect(meuPapelEm("e2")).resolves.toBe("ADMIN");
  });

  it("devolve null sem vínculo, em vez de estourar", async () => {
    // É a decisão do arquivo, e a razão de o retorno ser anulável: a tela usa
    // isto para esconder o que o usuário não pode fazer. Se estourasse, a
    // página de gestão quebraria para quem apenas não tem vínculo — que não é
    // erro, é o caso comum de quem abre um link que recebeu.
    chamar.mockResolvedValue([{ id: "e1", meuPapel: "ADMIN" }]);

    await expect(meuPapelEm("e2")).resolves.toBeNull();
  });

  it("devolve null quando o usuário não administra nada", async () => {
    chamar.mockResolvedValue([]);

    await expect(meuPapelEm("e1")).resolves.toBeNull();
  });
});

describe("limite da trilha", () => {
  it("repassa o limite que a tela pediu, e não um padrão próprio", async () => {
    // A tela pede 100 e oferece um vínculo para 500 em vez de paginar. O teto
    // de verdade é o do serviço da API (500); aqui o que se fixa é que a
    // consulta **não** reescreve o pedido da tela no caminho.
    await trilhaDoEstabelecimento(ID, 500);

    const [, , opcoes] = chamar.mock.calls[0];
    expect(opcoes).toEqual({ parametros: { limite: 500 } });
  });
});
