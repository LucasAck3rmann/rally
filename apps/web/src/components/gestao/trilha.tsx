// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";

import { cn } from "@/lib/cn";
import { ALVO_MINIMO, CAMPO_COMPACTO } from "@/lib/estilos";
import type { RegistroDaTrilha } from "@/lib/gestao/contratos";

/** O que a URL carrega. Filtro é link, e link dá para guardar nos favoritos. */
export type FiltroDaTrilha = {
  busca?: string;
  entidade?: string;
  limite?: number;
};

/** "conciliação" acha "Conciliacao": busca em português sem isto não acha nada. */
export function simples(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Aplica o filtro da URL sobre os registros já carregados.
 *
 * **Filtra na web e não na API de propósito.** A rota aceita só `limite`, e
 * acrescentar parâmetros de busca nela significaria índice novo por coluna
 * filtrável numa tabela que cresce para sempre. Sobre 100 ou 500 linhas em
 * memória a diferença é invisível, e o dia em que a trilha de uma arena
 * passar de 500 é o dia de paginar de verdade — não antes.
 *
 * A função é exportada separada da tela porque é onde o defeito mora: busca
 * em português que não dobra acento não acha "conciliação" quando se digita
 * "conciliacao", e isso não aparece em nenhuma inspeção visual.
 */
export function filtrar(registros: RegistroDaTrilha[], filtro: FiltroDaTrilha): RegistroDaTrilha[] {
  const busca = simples(filtro.busca ?? "");
  const entidade = filtro.entidade;

  return registros.filter((r) => {
    if (entidade && r.entidade !== entidade) return false;
    if (!busca) return true;
    // O identificador entra na busca porque é por ele que se procura uma
    // quadra específica depois de achá-la em outra tela.
    const alvo = simples(
      [r.acao, r.entidade, r.entidadeId ?? "", r.autor?.nome ?? "sistema"].join(" "),
    );
    return alvo.includes(busca);
  });
}

/**
 * Resumo do corpo enviado, para a linha dizer **o quê** e não só "editou".
 *
 * Só o primeiro nível, e isso espelha a garantia da API: o
 * `AuditoriaInterceptor` remove campo sensível **um nível adentro**, de modo
 * que expandir objeto aninhado aqui mostraria exatamente a profundidade que
 * ninguém limpou. Objeto dentro de objeto aparece como reticência — a tela
 * mostra tanto quanto a remoção alcança, nem um nível mais.
 */
export function resumoDosDados(dados: unknown): string | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const pares = Object.entries(dados as Record<string, unknown>)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
    .map(([chave, valor]) => `${chave}: ${valorCurto(valor)}`);
  return pares.length > 0 ? pares.join(" · ") : null;
}

function valorCurto(valor: unknown): string {
  if (typeof valor === "string") {
    return valor.length > 48 ? `${valor.slice(0, 48)}…` : valor;
  }
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (Array.isArray(valor)) {
    return `${valor.length} ${valor.length === 1 ? "item" : "itens"}`;
  }
  return "…";
}

const DIA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/**
 * Agrupa por dia, mantendo a ordem em que a API devolveu (mais recente
 * primeiro). `Map` preserva ordem de inserção, e é por isso que serve aqui.
 *
 * O fuso é o do navegador, como no resto do painel: quem lê a trilha está na
 * arena, e converter para o fuso do estabelecimento só mudaria algo para quem
 * audita de outro estado — caso que não existe hoje e que exigiria o campo
 * `timezone`, que esta rota não devolve.
 */
function porDia(registros: RegistroDaTrilha[]): [string, RegistroDaTrilha[]][] {
  const grupos = new Map<string, RegistroDaTrilha[]>();
  for (const registro of registros) {
    const chave = DIA_CURTO.format(new Date(registro.criadoEm));
    const existente = grupos.get(chave);
    if (existente) existente.push(registro);
    else grupos.set(chave, [registro]);
  }
  return [...grupos.entries()];
}

/** Monta o link do filtro preservando o que já estava aplicado. */
function comFiltro(base: string, filtro: FiltroDaTrilha): string {
  const query = new URLSearchParams();
  if (filtro.busca) query.set("busca", filtro.busca);
  if (filtro.entidade) query.set("entidade", filtro.entidade);
  if (filtro.limite) query.set("limite", String(filtro.limite));
  const texto = query.toString();
  return texto ? `${base}?${texto}` : base;
}

export function TrilhaDaArena({
  trilha,
  estabelecimentoId,
  filtro,
  teto,
}: {
  trilha: RegistroDaTrilha[];
  estabelecimentoId: string;
  filtro: FiltroDaTrilha;
  /** Quantos registros a API devolveu no máximo, para a tela ser honesta. */
  teto: number;
}) {
  const base = `/gestao/${estabelecimentoId}/auditoria`;
  const visiveis = filtrar(trilha, filtro);
  const entidades = [...new Set(trilha.map((r) => r.entidade))].sort();
  const filtrando = Boolean(filtro.busca || filtro.entidade);

  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Trilha de auditoria
        </h1>
        <p className="mt-1 text-[14px] text-gray">
          Quem fez o quê na arena. Só o administrador vê esta tela.
        </p>
      </header>

      {trilha.length === 0 ? (
        /* Trilha vazia de verdade é diferente de filtro que não achou nada, e
           confundir as duas faria o dono concluir que a auditoria não funciona
           quando ele só digitou um nome errado. */
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Nada registrado ainda. A trilha começa na próxima ação de gestão — liberar um horário,
          pausar uma quadra, trocar o papel de alguém.
        </p>
      ) : (
        <>
          {/* GET e `role="search"`, como os filtros públicos: a tela filtra sem
              JavaScript e cada filtro vira uma URL que dá para guardar. */}
          <form
            role="search"
            action={base}
            method="get"
            className="mt-7 flex flex-wrap items-end gap-3"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="busca"
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-gray"
              >
                Buscar por ação, pessoa ou identificador
              </label>
              <input
                id="busca"
                name="busca"
                type="search"
                defaultValue={filtro.busca}
                placeholder="pausar quadra, Augusto, q1"
                className={cn(CAMPO_COMPACTO, "mt-1 w-full")}
              />
            </div>
            <div>
              <label
                htmlFor="entidade"
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-gray"
              >
                Entidade
              </label>
              <select
                id="entidade"
                name="entidade"
                defaultValue={filtro.entidade ?? ""}
                className={cn(CAMPO_COMPACTO, "mt-1")}
              >
                {/* As opções saem do que a trilha tem, e não de uma lista fixa:
                    lista fixa envelhece calada quando uma entidade nova passa
                    a ser auditada. */}
                <option value="">Todas</option>
                {entidades.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            {filtro.limite ? <input type="hidden" name="limite" value={filtro.limite} /> : null}
            <button
              type="submit"
              className={cn(
                "rounded-button bg-ink px-5 text-[14px] font-semibold text-white",
                "transition hover:brightness-125",
                ALVO_MINIMO,
              )}
            >
              Filtrar
            </button>
            {filtrando ? (
              <Link
                href={comFiltro(base, { limite: filtro.limite })}
                className={cn(
                  "inline-flex items-center rounded-button border border-line",
                  "px-4 text-[14px] text-ink transition hover:bg-bg",
                  ALVO_MINIMO,
                )}
              >
                Limpar
              </Link>
            ) : null}
          </form>

          <p className="mt-4 text-[13px] text-gray">
            {visiveis.length} de {trilha.length} registro
            {trilha.length === 1 ? "" : "s"}
            {trilha.length >= teto ? ` · mostrando os ${teto} mais recentes` : ""}
            {trilha.length >= teto && teto < 500 ? (
              <>
                {" · "}
                <Link
                  href={comFiltro(base, { ...filtro, limite: 500 })}
                  className="font-semibold text-coral-deep underline"
                >
                  ver 500
                </Link>
              </>
            ) : null}
          </p>

          {visiveis.length === 0 ? (
            <p className="mt-7 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
              Nenhum registro para esse filtro. A trilha tem {trilha.length} no período carregado.
            </p>
          ) : (
            porDia(visiveis).map(([dia, registros]) => (
              <section key={dia} className="mt-8">
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray">
                  {DIA.format(new Date(registros[0].criadoEm))}
                </h2>
                <ol className="mt-3 overflow-hidden rounded-card border border-line bg-white">
                  {registros.map((r) => {
                    const dados = resumoDosDados(r.dados);
                    return (
                      <li
                        key={r.id}
                        className="flex gap-4 border-b border-line/60 px-5 py-3.5 last:border-b-0"
                      >
                        <time
                          dateTime={r.criadoEm}
                          className="shrink-0 pt-0.5 font-mono text-[12px] text-gray"
                        >
                          {HORA.format(new Date(r.criadoEm))}
                        </time>
                        <div className="min-w-0">
                          <p className="text-[14px] text-ink">
                            <strong className="font-semibold">
                              {/* Ação de sistema tem autor nulo. Um travessão
                                  deixaria a pergunta "quem?" sem resposta. */}
                              {r.autor?.nome ?? "Sistema"}
                            </strong>{" "}
                            {r.acao}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-gray">
                            {r.entidade}
                            {r.entidadeId ? ` · ${r.entidadeId}` : ""}
                          </p>
                          {dados ? (
                            <p className="mt-1 break-words text-[12px] text-gray">{dados}</p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))
          )}
        </>
      )}

      {/* O limite da trilha, dito de frente — como a nota do gateway na
          conciliação. A escrita acontece depois da ação e nunca a bloqueia,
          logo uma falha de banco perde a linha sem desfazer a operação. */}
      <p className="mt-10 text-[13px] text-gray">
        A trilha é de <strong>melhor esforço</strong>: ela é escrita depois de a ação acontecer,
        para que uma falha de registro nunca impeça o trabalho no balcão. O preço é que uma
        indisponibilidade do banco entre a ação e o registro deixa um buraco — que fica no log do
        servidor. Nenhum registro é apagado ou editado, e não existe rota para isso.
      </p>
    </div>
  );
}
