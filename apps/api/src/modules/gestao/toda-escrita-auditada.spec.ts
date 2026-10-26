// SPDX-License-Identifier: AGPL-3.0-or-later
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ACAO_AUDITADA, DescricaoDaAcao } from "../auditoria/auditar.decorator";
import { GestaoModule } from "./gestao.module";

/**
 * **Toda rota de escrita da gestão é auditada (RN-05).**
 *
 * Esta é a âncora que faltou no portão de alvo de toque do #95: lá o portão
 * existia, a barra lateral **não estava na lista de cenários**, e o botão
 * "Sair" com 33 px passou por ele. A lição foi nomeada então — *portão
 * alimentado à mão precisa de uma âncora que cubra a alimentação* — e esta
 * suíte é a aplicação dela.
 *
 * A trilha é alimentada pelo decorador `@Auditar` em cada rota. Rota de
 * escrita nova sem o decorador **não é auditada**, e nada no sistema
 * reclamaria: a operação funciona, a trilha só não tem a linha. Este teste é
 * o que transforma esse silêncio em falha de integração — e, se a rota nova
 * for deliberadamente não auditável, a exceção se declara aqui, com o motivo.
 */

/**
 * Os controladores vêm **do próprio módulo**, e não de uma lista aqui.
 *
 * Esta lista era escrita à mão, e em 17/10 ela mostrou o limite dessa escolha:
 * o `RecorrenciasController` entrou no `GestaoModule` com quatro rotas de
 * escrita e **o portão não o viu**, porque ninguém o acrescentou aqui. Ele
 * passava verde sobre um controlador que não tinha conferido.
 *
 * É a lição do #95 levada um passo adiante. Lá a resposta foi *portão
 * alimentado à mão precisa de âncora que cubra a alimentação*; aqui a resposta
 * é melhor — **não alimentar à mão**. O Nest guarda os controladores do módulo
 * em metadado, de modo que a fonte da lista passa a ser a mesma que o
 * aplicativo usa para registrar as rotas: controlador novo entra no portão no
 * instante em que entra no módulo.
 */
/** O esquema, que e a fonte dos nomes de entidade. */
const schema = readFileSync(join(__dirname, "..", "..", "..", "prisma", "schema.prisma"), "utf-8");

const CONTROLADORES = (Reflect.getMetadata("controllers", GestaoModule) ?? []) as {
  name: string;
  prototype: object;
}[];

const ESCRITA = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

/**
 * Rotas de escrita que **não** são auditadas, com o motivo.
 *
 * A lista está vazia, e isso é uma afirmação: hoje nenhuma escrita da gestão
 * fica fora da trilha. Se uma entrar aqui, o motivo vem junto.
 */
const EXCECOES: Record<string, string> = {};

type Rota = {
  controlador: string;
  metodo: string;
  verbo: RequestMethod;
  caminho: string;
  auditada: DescricaoDaAcao | undefined;
};

function rotas(): Rota[] {
  const achadas: Rota[] = [];
  for (const controlador of CONTROLADORES) {
    const proto = controlador.prototype as unknown as Record<string, unknown>;
    for (const nome of Object.getOwnPropertyNames(proto)) {
      if (nome === "constructor") continue;
      const alvo = proto[nome];
      if (typeof alvo !== "function") continue;

      const verbo = Reflect.getMetadata(METHOD_METADATA, alvo) as RequestMethod | undefined;
      if (verbo === undefined) continue;

      achadas.push({
        controlador: controlador.name,
        metodo: nome,
        verbo,
        caminho: String(Reflect.getMetadata(PATH_METADATA, alvo) ?? "/"),
        auditada: Reflect.getMetadata(ACAO_AUDITADA, alvo) as DescricaoDaAcao | undefined,
      });
    }
  }
  return achadas;
}

describe("RN-05 — toda escrita da gestão deixa rastro", () => {
  const todas = rotas();

  it("a varredura acha rotas de verdade, e não uma lista vazia", () => {
    // Sem esta âncora, um erro na leitura do metadado faria o teste passar
    // varrendo nada — e passaria a provar o contrário do que promete.
    expect(todas.length).toBeGreaterThan(15);
    expect(todas.filter((r) => ESCRITA.has(r.verbo)).length).toBeGreaterThan(8);
  });

  it("nenhuma rota de escrita fica fora da trilha", () => {
    const semAuditoria = todas
      .filter((r) => ESCRITA.has(r.verbo) && !r.auditada)
      .map((r) => `${r.controlador}.${r.metodo} (${r.caminho})`)
      .filter((chave) => !(chave in EXCECOES));

    // O valor afirmado já carrega o nome do controlador e do método, de modo
    // que a saída do Jest diz **qual** rota ficou de fora. (O `expect` do Jest
    // não aceita mensagem como segundo argumento — isso é do Vitest, e os dois
    // convivem neste monorepo.)
    expect(semAuditoria).toEqual([]);
  });

  it("rota de leitura não é auditada", () => {
    // A trilha responde "quem **fez** o quê". Registrar quem abriu o painel
    // encheria a tabela de linhas sem consequência e afogaria o que importa —
    // e o painel é aberto a cada navegação.
    const leiturasAuditadas = todas
      .filter((r) => r.verbo === RequestMethod.GET && r.auditada)
      .map((r) => `${r.controlador}.${r.metodo}`);

    expect(leiturasAuditadas).toEqual([]);
  });

  it("cada ação auditada tem verbo em português e entidade do domínio", () => {
    // O texto é lido pelo dono da arena, não pelo time: "pausar quadra" e não
    // "PATCH /quadras/:id". E a entidade precisa ser uma do modelo, para que
    // a trilha possa ser filtrada por ela.
    // As entidades saem do **esquema**, pela mesma razão que os controladores
    // saem do módulo: lista escrita à mão envelhece calada. Esta tinha seis
    // nomes e não incluía `Recorrencia`, de modo que uma entidade nova do
    // modelo seria recusada pelo portão como se fosse erro de digitação.
    const ENTIDADES = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));
    expect(ENTIDADES.size).toBeGreaterThan(15);

    // Cada afirmacao leva a rota dentro do valor, para a falha dizer qual e.
    const curtas: string[] = [];
    const comMaiuscula: string[] = [];
    const foraDoModelo: string[] = [];
    for (const r of todas.filter((x) => x.auditada)) {
      const { acao, entidade } = r.auditada!;
      const onde = `${r.controlador}.${r.metodo}`;
      if (acao.length <= 3) curtas.push(onde);
      if (acao !== acao.toLowerCase()) comMaiuscula.push(`${onde}: ${acao}`);
      if (!ENTIDADES.has(entidade)) foraDoModelo.push(`${onde}: ${entidade}`);
    }
    expect(curtas).toEqual([]);
    expect(comMaiuscula).toEqual([]);
    expect(foraDoModelo).toEqual([]);
  });

  it("quando a rota tem identificador na URL, a trilha o registra", () => {
    // Sem o `parametro`, a linha diz "editou uma quadra" sem dizer **qual** —
    // e numa arena com seis quadras isso não responde à pergunta.
    const comIdNaRota = todas.filter((r) => r.auditada && /:(\w+)/.test(r.caminho));
    const semParametro = comIdNaRota
      .filter((r) => !r.auditada!.parametro)
      .map((r) => `${r.controlador}.${r.metodo} (${r.caminho})`);

    expect(semParametro).toEqual([]);
    // E o parametro declarado existe mesmo no caminho — um nome errado ali
    // faria `entidadeId` ficar nulo sem ninguem notar.
    const parametroInexistente = comIdNaRota
      .filter((r) => !r.caminho.includes(`:${r.auditada!.parametro}`))
      .map(
        (r) => `${r.controlador}.${r.metodo}: :${r.auditada!.parametro} nao esta em ${r.caminho}`,
      );
    expect(parametroInexistente).toEqual([]);
  });

  it("a trilha não tem rota de escrita — registro que se apaga não é registro", () => {
    const escritasDaAuditoria = todas.filter(
      (r) => r.controlador === "AuditoriaController" && ESCRITA.has(r.verbo),
    );

    expect(escritasDaAuditoria).toEqual([]);
  });
});
