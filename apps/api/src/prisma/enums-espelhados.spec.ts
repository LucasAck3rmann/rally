// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **Todo valor de enum da API que um cliente traduz está traduzido (RNF-14, RN-16).**
 *
 * O esquema é a fonte: `schema.prisma` define os enums, e o aplicativo e a web
 * os **espelham** — o app num `switch doTexto`, a web num `z.enum`. Espelho é
 * cópia, e cópia diverge.
 *
 * **O que este portão existe para pegar.** O app já degrada com elegância:
 * valor que ele não conhece cai num `desconhecido` e a tela diz "Status
 * indisponível" em vez de inventar um rótulo. Isso é bom e continua valendo —
 * mas **degradação graciosa não é detecção**. Se a API ganhar
 * `PagamentoStatus.CONTESTADO`, o aplicativo mostra "indisponível", ninguém é
 * avisado, e o requisito passa a ser atendido pela metade em silêncio. Aqui a
 * CI reprova e nomeia o valor que falta.
 *
 * **O defeito que o motivou.** Em 16/10, com a classe dada como fechada pelo
 * #104, duas cópias ainda recebiam um valor da API pelo `_`: o `LEMBRETE` em
 * `NotificacaoTipo` e o `ATENDENTE` em `PapelGestao`. O segundo era o grave,
 * porque o papel **volta para a API**: lido como atendente e reenviado,
 * rebaixava a pessoa de verdade. Dois erros da mesma forma, num lugar que
 * ninguém olhava, é o que justifica um portão em vez de uma terceira revisão
 * à mão.
 */

const RAIZ = join(__dirname, "..", "..", "..", "..");

function ler(...partes: string[]): string {
  return readFileSync(join(RAIZ, ...partes), "utf-8");
}

/** Os enums do esquema, que é a fonte. */
function enumsDoEsquema(): Map<string, string[]> {
  const schema = ler("apps", "api", "prisma", "schema.prisma");
  const achados = new Map<string, string[]>();
  for (const m of schema.matchAll(/^enum (\w+) \{([^}]*)\}/gm)) {
    const valores = m[2]
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, "").trim())
      .filter((l) => /^[A-Z][A-Z0-9_]*$/.test(l));
    achados.set(m[1], valores);
  }
  return achados;
}

/**
 * Os valores que um `switch doTexto` do app traduz **explicitamente**.
 *
 * Só os literais com `=>` contam. O `_ => X.desconhecido` é de propósito
 * invisível para esta leitura: ele é o que faz o valor novo passar calado, e
 * é justamente isso que o portão mede.
 */
function espelhoDoApp(arquivo: string, nomeDoEnum: string): string[] {
  const fonte = ler("apps", "mobile", "lib", "features", ...arquivo.split("/"));
  const bloco = new RegExp(
    `static ${nomeDoEnum} doTexto\\(String valor\\) => switch \\(valor\\) \\{([\\s\\S]*?)\\n *\\};`,
  ).exec(fonte);
  if (!bloco) throw new Error(`não achei o doTexto de ${nomeDoEnum} em ${arquivo}`);
  return [...bloco[1].matchAll(/"([A-Z][A-Z0-9_]*)"\s*=>/g)].map((m) => m[1]);
}

/** Os valores de um `z.enum([...])` da web, pelo nome da constante. */
function espelhoDaWeb(arquivo: string, constante: string): string[] {
  const fonte = ler("apps", "web", "src", ...arquivo.split("/"));
  const bloco = new RegExp(`export const ${constante} = z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`).exec(
    fonte,
  );
  if (!bloco) throw new Error(`não achei o z.enum de ${constante} em ${arquivo}`);
  return [...bloco[1].matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((m) => m[1]);
}

/**
 * Os espelhos que existem hoje, e o que cada um **não** precisa cobrir.
 *
 * `ignorar` é a parte honesta da tabela: valor da API que o cliente não tem
 * por que conhecer entra aqui **com o motivo**, e não some por omissão.
 */
const ESPELHOS: {
  enumDaApi: string;
  onde: string;
  valores: () => string[];
  ignorar?: Record<string, string>;
}[] = [
  {
    enumDaApi: "ReservaStatus",
    onde: "app · reserva.dart",
    valores: () => espelhoDoApp("reservas/domain/reserva.dart", "ReservaStatus"),
  },
  {
    enumDaApi: "PagamentoStatus",
    onde: "app · reserva.dart",
    valores: () => espelhoDoApp("reservas/domain/reserva.dart", "PagamentoStatus"),
  },
  {
    enumDaApi: "NotificacaoTipo",
    onde: "app · notificacao.dart",
    valores: () => espelhoDoApp("notificacoes/domain/notificacao.dart", "NotificacaoTipo"),
  },
  {
    enumDaApi: "Role",
    onde: "app · gestao.dart",
    valores: () => espelhoDoApp("gestao/domain/gestao.dart", "PapelGestao"),
    ignorar: {
      // O seletor de gestão lista vínculos de quem administra algo, e
      // `CLIENTE` não é vínculo de gestão — ele nunca chega nessas rotas.
      CLIENTE: "não é papel de gestão; não chega às rotas de arena",
    },
  },
  {
    enumDaApi: "Role",
    onde: "web · contratos.ts (Papel)",
    valores: () => espelhoDaWeb("lib/gestao/contratos.ts", "Papel"),
    ignorar: { CLIENTE: "não é papel de gestão; não chega às rotas de arena" },
  },
];

describe("os espelhos de enum acompanham o esquema", () => {
  const esquema = enumsDoEsquema();

  it("a leitura do esquema acha enums de verdade", () => {
    // Sem esta âncora, uma expressão regular errada faria o portão comparar
    // listas vazias e passar provando o contrário do que promete.
    expect(esquema.size).toBeGreaterThan(8);
    expect(esquema.get("PagamentoStatus")).toEqual([
      "PENDENTE",
      "PAGO",
      "EXPIRADO",
      "ESTORNADO",
      "FALHOU",
    ]);
  });

  it.each(ESPELHOS)("$onde cobre todo valor de $enumDaApi", (espelho) => {
    const daApi = esquema.get(espelho.enumDaApi);
    // O valor afirmado leva o nome do enum, porque o `expect` do Jest não
    // aceita mensagem como segundo argumento — isso é do Vitest, e os dois
    // convivem neste monorepo.
    expect({ enum: espelho.enumDaApi, achado: daApi !== undefined }).toEqual({
      enum: espelho.enumDaApi,
      achado: true,
    });

    const traduzidos = new Set(espelho.valores());
    // A leitura do espelho também precisa de âncora própria: um `doTexto`
    // que o regex não achasse voltaria vazio e reprovaria por motivo errado.
    expect(traduzidos.size).toBeGreaterThan(1);

    const faltando = daApi!
      .filter((v) => !traduzidos.has(v))
      .filter((v) => !(espelho.ignorar && v in espelho.ignorar));

    // O valor afirmado carrega os nomes, de modo que a falha do Jest diz
    // **qual** valor ficou sem tradução e em que arquivo.
    expect(faltando).toEqual([]);
  });

  it.each(ESPELHOS)("$onde não inventa valor que a API não tem", (espelho) => {
    // O inverso importa igual: cliente que traduz `CANCELADO` quando a API
    // diz `CANCELADA` nunca casa, e o `_` engole o erro para sempre.
    const daApi = new Set(esquema.get(espelho.enumDaApi) ?? []);
    const inventados = espelho.valores().filter((v) => !daApi.has(v));

    expect(inventados).toEqual([]);
  });

  it("todo motivo de exceção está escrito, e nenhum sobra", () => {
    // Exceção sem motivo é omissão com outro nome. E exceção para valor que
    // a API já removeu é lixo que passa a esconder o próximo caso.
    const semMotivo: string[] = [];
    const obsoletas: string[] = [];
    for (const espelho of ESPELHOS) {
      const daApi = new Set(esquema.get(espelho.enumDaApi) ?? []);
      for (const [valor, motivo] of Object.entries(espelho.ignorar ?? {})) {
        if (motivo.trim().length < 20) semMotivo.push(`${espelho.onde}: ${valor}`);
        if (!daApi.has(valor)) obsoletas.push(`${espelho.onde}: ${valor}`);
      }
    }
    expect(semMotivo).toEqual([]);
    expect(obsoletas).toEqual([]);
  });
});
