// SPDX-License-Identifier: AGPL-3.0-or-later
const itens = [
  "Beach tennis",
  "Futevôlei",
  "Vôlei de praia",
  "Agenda em tempo real",
  "Pix em segundos",
  "Replays dos pontos",
  "Sem conflito de horário",
];

/**
 * Faixa "ao vivo" do topo. A animação é CSS puro (tailwind.config), então a
 * seção continua sendo Server Component — e para em `prefers-reduced-motion`.
 * A segunda cópia existe só para o laço não ter emenda: fica fora da
 * árvore de acessibilidade.
 */
export function Marquee() {
  return (
    <div className="overflow-hidden border-b border-ink/20 bg-ink py-3">
      <div className="flex w-max animate-marquee">
        {[0, 1].map((copia) => (
          <ul
            key={copia}
            aria-hidden={copia === 1 || undefined}
            className="flex shrink-0 items-center gap-8 pr-8 font-mono text-[11px] uppercase tracking-[0.22em] text-white/70"
          >
            {itens.map((item) => (
              <li key={item} className="flex items-center gap-8 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
