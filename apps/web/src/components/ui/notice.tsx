// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Painel de estado — vazio, erro ou aviso. Um só componente para os três
 * porque a diferença é de texto, não de forma.
 */
export function Notice({
  rotulo,
  titulo,
  children,
  tom = "neutro",
  className,
}: {
  rotulo: string;
  titulo: string;
  children?: ReactNode;
  tom?: "neutro" | "atencao";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border p-8 text-center",
        tom === "atencao" ? "border-coral/40 bg-coral/5" : "border-line bg-white",
        className,
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral-deep">{rotulo}</p>
      <p className="mt-3 font-display text-xl font-bold text-ink">{titulo}</p>
      {children ? (
        <div className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-gray">
          {children}
        </div>
      ) : null}
    </div>
  );
}
