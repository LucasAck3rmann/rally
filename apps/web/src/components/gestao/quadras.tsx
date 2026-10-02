// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from "@/lib/cn";
import { formatarPreco } from "@/lib/formato";
import type { QuadraDaGestao } from "@/lib/gestao/contratos";

export function QuadrasDaArena({ quadras }: { quadras: QuadraDaGestao[] }) {
  const pausadas = quadras.filter((q) => !q.ativo).length;

  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Quadras
        </h1>
        <p className="mt-1 text-[14px] text-gray">
          {quadras.length === 0
            ? "Nenhuma quadra cadastrada"
            : `${quadras.length} quadra${quadras.length > 1 ? "s" : ""}${
                pausadas > 0
                  ? ` · ${pausadas} pausada${pausadas > 1 ? "s" : ""}`
                  : ""
              }`}
        </p>
      </header>

      {quadras.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Cadastre a primeira quadra pelo aplicativo para ela aparecer na busca
          dos jogadores.
        </p>
      ) : (
        <ul className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quadras.map((quadra) => (
            <li
              key={quadra.id}
              className="flex flex-col rounded-card border border-line bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-[17px] font-bold text-ink">
                    {quadra.nome}
                  </h2>
                  <p className="mt-1 truncate text-[13px] text-gray">
                    {quadra.modalidades.length === 0
                      ? "Sem modalidade"
                      : quadra.modalidades.join(" · ")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-chip px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
                    quadra.ativo
                      ? "bg-sand text-ink"
                      : "bg-coral/10 text-coral-deep",
                  )}
                >
                  {quadra.ativo ? "Na vitrine" : "Pausada"}
                </span>
              </div>

              <p className="mt-4 font-display text-[20px] font-bold text-ink">
                {formatarPreco(quadra.precoHora)}
                <span className="ml-1 font-body text-[13px] font-normal text-gray">
                  / hora
                </span>
              </p>

              {quadra.faixasPreco.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {quadra.faixasPreco.map((faixa, i) => (
                    <li
                      key={faixa.id ?? i}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="truncate text-gray">
                        {rotuloDoDia(faixa.diaSemana)} · {faixa.horaInicio}–
                        {faixa.horaFim}
                      </span>
                      <span className="shrink-0 font-semibold text-ink">
                        {formatarPreco(faixa.precoHora)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {quadra.comodidades.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {quadra.comodidades.map((c) => (
                    <li
                      key={c}
                      className="rounded-chip bg-bg px-2.5 py-1 text-[11px] text-gray"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              ) : null}

              {quadra.capacidade ? (
                <p className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                  Até {quadra.capacidade} pessoas
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Editar ainda é só no aplicativo. Dizer isso é melhor que deixar o
          dono procurar um botão que não existe. */}
      <p className="mt-8 text-[13px] text-gray">
        Cadastrar e editar quadra, por enquanto, é pelo aplicativo.
      </p>
    </div>
  );
}

/** `null` em `diaSemana` quer dizer "todos os dias" — o caso mais comum. */
function rotuloDoDia(diaSemana: number | null): string {
  if (diaSemana === null) return "Todos os dias";
  return (
    ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
      diaSemana
    ] ?? "Todos os dias"
  );
}
