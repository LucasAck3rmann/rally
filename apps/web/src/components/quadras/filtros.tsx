// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import { MODALIDADES } from "@/lib/api/quadras";
import { cn } from "@/lib/cn";

/** Monta o link de um chip preservando o que já estava filtrado. */
function comFiltro(parametros: { busca?: string; modalidade?: string }): string {
  const query = new URLSearchParams();
  if (parametros.busca) query.set("busca", parametros.busca);
  if (parametros.modalidade) query.set("modalidade", parametros.modalidade);
  const texto = query.toString();
  return texto ? `/quadras?${texto}` : "/quadras";
}

/**
 * Busca e chips de modalidade. Formulário GET nativo e chips que são links:
 * a página inteira funciona sem JavaScript, e cada filtro vira uma URL que dá
 * para compartilhar.
 */
export function Filtros({ busca, modalidade }: { busca?: string; modalidade?: string }) {
  const chips = [
    { rotulo: "Todas", valor: undefined },
    ...MODALIDADES.map((m) => ({ rotulo: m, valor: m })),
  ];

  return (
    <div>
      <form role="search" action="/quadras" method="get" className="flex flex-wrap gap-3">
        <label htmlFor="busca" className="sr-only">
          Buscar por quadra, arena ou bairro
        </label>
        <input
          id="busca"
          name="busca"
          type="search"
          defaultValue={busca}
          placeholder="Quadra, arena ou bairro"
          className="min-h-[44px] flex-1 rounded-button border border-line bg-white px-4 text-[15px] text-ink placeholder:text-gray"
        />
        {modalidade ? <input type="hidden" name="modalidade" value={modalidade} /> : null}
        <button
          type="submit"
          className="min-h-[44px] rounded-button bg-ink px-5 text-[15px] font-semibold text-white transition hover:brightness-125"
        >
          Buscar
        </button>
      </form>

      <ul className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const ativo = chip.valor === modalidade;
          return (
            <li key={chip.rotulo}>
              <Link
                href={comFiltro({ busca, modalidade: chip.valor })}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-chip border px-4 font-mono text-[11px] uppercase tracking-[0.16em] transition",
                  ativo
                    ? "border-coral bg-coral text-ink"
                    : "border-line bg-white text-gray hover:border-ink/25 hover:text-ink",
                )}
              >
                {chip.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
