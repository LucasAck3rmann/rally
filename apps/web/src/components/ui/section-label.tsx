// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Rótulo editorial: Space Mono em caixa alta com índice entre parênteses —
 * o acabamento de craft descrito em "Telas e Fluxos".
 */
export function SectionLabel({
  index,
  children,
  className,
  tone = "light",
}: {
  index?: string;
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.22em]",
        tone === "light" ? "text-gray" : "text-white/60",
        className,
      )}
    >
      {index ? (
        <span className={tone === "light" ? "text-coral-deep" : "text-coral"}>({index}) </span>
      ) : null}
      {children}
    </p>
  );
}
