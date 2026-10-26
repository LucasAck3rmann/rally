// SPDX-License-Identifier: AGPL-3.0-or-later
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { Role } from "@prisma/client";

import { PAPEIS_EXIGIDOS } from "../auth/decorators/papeis.decorator";
import { GestaoModule } from "./gestao.module";

/**
 * **Toda rota da gestão é lida dentro do estabelecimento da URL (sem IDOR).**
 *
 * O `PapelGuard` confere o papel **dentro do estabelecimento da URL** (ADR-0011).
 * Ele responde "esta pessoa manda nesta arena?" — e **não** "este recurso é
 * desta arena?". A segunda pergunta é do serviço, e só dá para fazê-la se o
 * manipulador receber o `estabelecimentoId` para repassar.
 *
 * Esta suíte nasceu de um defeito real. O `RecorrenciasController.materializar`
 * era a **única** rota da gestão que endereçava um recurso por id sem receber
 * o `estabelecimentoId`:
 *
 * ```
 * @Post(":id/materializar")
 * materializar(@Param("id") id: string) {
 *   return this.recorrencias.materializar(id);   // findUnique({ where: { id } })
 * }
 * ```
 *
 * Um admin da arena A chamando
 * `POST /gestao/estabelecimentos/<A>/mensalistas/<série-de-B>/materializar`
 * passava pelo guarda — o papel dele em A é real — e a escrita caía na agenda
 * de **B**: reservas criadas numa arena de que ele não participa.
 *
 * Nada reclamava. O teste do serviço chamava `materializar("s1")` direto e
 * provava a materialização, que estava certa; o portão de auditoria conferia
 * que a rota deixa rastro, e deixava. O que faltava era alguém perguntar de
 * **qual arena** o recurso é — e essa pergunta não cabe num teste por rota,
 * porque o defeito é a rota que ninguém lembrou de escrever.
 *
 * Por isso a varredura, e pelo mesmo motivo do portão de auditoria ao lado:
 * os controladores vêm **do módulo**, não de uma lista aqui. Rota nova entra
 * no portão no instante em que entra no módulo.
 */

const CONTROLADORES = (Reflect.getMetadata("controllers", GestaoModule) ?? []) as {
  name: string;
  prototype: object;
}[];

/** Códigos do Nest para a origem de cada argumento do manipulador. */
const DE_CORPO = 3;
const DE_CONSULTA = 4;
const DE_ROTA = 5;

const ESCRITA = new Set([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

type Argumento = { origem: number; nome: string | undefined };

type Rota = {
  controlador: string;
  metodo: string;
  verbo: RequestMethod;
  /** Caminho completo: o prefixo do controlador mais o do manipulador. */
  caminho: string;
  argumentos: Argumento[];
  papeis: Role[] | undefined;
};

function rotas(): Rota[] {
  const achadas: Rota[] = [];
  for (const controlador of CONTROLADORES) {
    const prefixo = String(Reflect.getMetadata(PATH_METADATA, controlador) ?? "");
    const proto = controlador.prototype as unknown as Record<string, unknown>;
    for (const nome of Object.getOwnPropertyNames(proto)) {
      if (nome === "constructor") continue;
      const alvo = proto[nome];
      if (typeof alvo !== "function") continue;

      const verbo = Reflect.getMetadata(METHOD_METADATA, alvo) as RequestMethod | undefined;
      if (verbo === undefined) continue;

      const crus = (Reflect.getMetadata(ROUTE_ARGS_METADATA, controlador, nome) ?? {}) as Record<
        string,
        { data?: unknown }
      >;

      const argumentos: Argumento[] = Object.entries(crus).map(([chave, valor]) => ({
        origem: Number(chave.split(":")[0]),
        nome: typeof valor.data === "string" ? valor.data : undefined,
      }));

      const sufixo = String(Reflect.getMetadata(PATH_METADATA, alvo) ?? "");
      achadas.push({
        controlador: controlador.name,
        metodo: nome,
        verbo,
        caminho: `${prefixo}/${sufixo}`.replace(/\/+$/, "").replace(/\/\//g, "/"),
        argumentos,
        papeis: Reflect.getMetadata(PAPEIS_EXIGIDOS, alvo) as Role[] | undefined,
      });
    }
  }
  return achadas;
}

/** As rotas que vivem sob `:estabelecimentoId` — as outras não são de arena. */
function daArena(todas: Rota[]): Rota[] {
  return todas.filter((r) => r.caminho.includes(":estabelecimentoId"));
}

function onde(r: Rota): string {
  return `${r.controlador}.${r.metodo} (${r.caminho})`;
}

describe("sem IDOR — toda rota da gestão sabe de qual arena é o recurso", () => {
  const todas = rotas();
  const arena = daArena(todas);

  it("a varredura acha rotas de verdade, e não uma lista vazia", () => {
    // Sem esta âncora, um erro na leitura do metadado faria o portão passar
    // varrendo nada — e passaria a provar o contrário do que promete. É a
    // mesma âncora do portão de auditoria ao lado, pela mesma razão.
    expect(todas.length).toBeGreaterThan(15);
    expect(arena.length).toBeGreaterThan(12);
    expect(arena.filter((r) => ESCRITA.has(r.verbo)).length).toBeGreaterThan(8);
  });

  it("toda rota de arena recebe o `estabelecimentoId` da própria URL", () => {
    // É a asserção que o `materializar` reprovava. Sem o parâmetro em mãos, o
    // manipulador não tem como pedir ao serviço que confira o dono do
    // recurso, por mais correto que o serviço seja.
    const sem = arena
      .filter(
        (r) => !r.argumentos.some((a) => a.origem === DE_ROTA && a.nome === "estabelecimentoId"),
      )
      .map(onde);

    expect(sem).toEqual([]);
  });

  it("o `estabelecimentoId` nunca vem do corpo nem da consulta", () => {
    // O guarda confere o **parâmetro da URL**. Se o manipulador lesse a arena
    // do corpo, o guarda aprovaria por uma arena e o serviço escreveria em
    // outra — a mesma falha do `materializar`, por outra porta, e esta sem
    // nem precisar de id de recurso alheio.
    const forjavel = todas
      .filter((r) =>
        r.argumentos.some(
          (a) =>
            a.nome === "estabelecimentoId" && (a.origem === DE_CORPO || a.origem === DE_CONSULTA),
        ),
      )
      .map(onde);

    expect(forjavel).toEqual([]);
  });

  it("toda escrita na arena exige ADMIN, e nenhuma leitura o exige por acidente", () => {
    // A separação é de operação, e está escrita em cada controlador: ler é de
    // toda a equipe com vínculo — o atendente precisa saber quem joga às 19h
    // —, escrever é do admin, porque tirar horário da venda, mexer em preço
    // ou trocar papel de alguém custa dinheiro ou acesso.
    const escritaSemAdmin = arena
      .filter((r) => ESCRITA.has(r.verbo) && !r.papeis?.includes(Role.ADMIN))
      .map(onde);

    expect(escritaSemAdmin).toEqual([]);

    // A trilha de auditoria é a exceção **declarada**: é leitura e é só do
    // admin, porque ela mostra o que a equipe inteira fez. O resto do painel
    // é de quem tem vínculo.
    const leiturasRestritas = arena
      .filter((r) => r.verbo === RequestMethod.GET && r.papeis !== undefined)
      .map((r) => r.controlador);

    expect([...new Set(leiturasRestritas)]).toEqual(["AuditoriaController"]);
  });

  it("rota que endereça outro recurso por id leva os dois identificadores", () => {
    // O caso geral do defeito: `:id` sozinho não diz de quem é o recurso. A
    // afirmação leva os nomes dentro do valor para a falha dizer qual rota e
    // qual parâmetro ficaram sem par.
    const comOutroId = arena.filter((r) =>
      [...r.caminho.matchAll(/:(\w+)/g)].some((m) => m[1] !== "estabelecimentoId"),
    );
    expect(comOutroId.length).toBeGreaterThan(5);

    const semPar = comOutroId
      .filter((r) => {
        const naRota = new Set(r.argumentos.filter((a) => a.origem === DE_ROTA).map((a) => a.nome));
        const naUrl = [...r.caminho.matchAll(/:(\w+)/g)].map((m) => m[1]);
        return naUrl.some((p) => !naRota.has(p));
      })
      .map((r) => onde(r));

    expect(semPar).toEqual([]);
  });
});
