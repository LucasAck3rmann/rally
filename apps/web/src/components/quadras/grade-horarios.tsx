// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import type { Disponibilidade } from "@/lib/api/quadras";
import { cn } from "@/lib/cn";
import { dataPorExtenso, formatarPreco, proximosDias, rotuloDoDia } from "@/lib/formato";

/**
 * Seletor de dia: cada dia é um link `?data=`, então a grade é renderizada no
 * servidor e a navegação funciona sem JavaScript — e cada dia tem URL própria.
 */
export function SeletorDeDia({
  quadraId,
  selecionado,
  dias = 7,
}: {
  quadraId: string;
  selecionado: string;
  dias?: number;
}) {
  return (
    <nav aria-label="Escolher o dia">
      <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {proximosDias(dias).map((dia) => {
          const ativo = dia === selecionado;
          return (
            <li key={dia}>
              <Link
                href={`/quadras/${quadraId}?data=${dia}`}
                aria-current={ativo ? "date" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center whitespace-nowrap rounded-chip border px-4 font-mono text-[11px] uppercase tracking-[0.16em] transition",
                  ativo
                    ? "border-coral bg-coral text-ink"
                    : "border-line bg-white text-gray hover:border-ink/25 hover:text-ink",
                )}
              >
                {rotuloDoDia(dia)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function GradeDeHorarios({ disponibilidade }: { disponibilidade: Disponibilidade }) {
  const { slots, slotMinutos } = disponibilidade;
  const livres = slots.filter((slot) => slot.disponivel).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-ink">
          Horários de <span className="capitalize">{dataPorExtenso(disponibilidade.data)}</span>
        </h2>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray">
          {livres} de {slots.length} livres · {slotMinutos} min
        </p>
      </div>

      {slots.length === 0 ? (
        <p className="mt-5 rounded-card border border-line bg-white p-6 text-center text-[15px] text-gray">
          A quadra não abre neste dia.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {slots.map((slot) => (
            <li key={slot.inicio}>
              <div
                className={cn(
                  "flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-button border px-2 py-2 text-center",
                  slot.disponivel
                    ? "border-line bg-white"
                    : "border-line/60 bg-sand/40 text-gray line-through decoration-gray/40",
                )}
              >
                <span className="font-display text-[15px] font-bold leading-none text-ink">
                  {slot.hora}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray">
                  {slot.disponivel ? formatarPreco(slot.preco) : "ocupado"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
