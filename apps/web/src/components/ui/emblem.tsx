// SPDX-License-Identifier: AGPL-3.0-or-later
import { cn } from "@/lib/cn";
import { colors as tokens } from "@rally/tokens";

/**
 * Emblema/carimbo do Rally (EST. 2026) — mesmo desenho do app, exportado do
 * Figma. Marca e acento, nunca conteúdo (DESIGN.md).
 */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-8 w-8", className)}
    >
      <circle cx="12" cy="12" r="11.04" fill="#FFF7EE" stroke="#1C2B33" strokeWidth="3" />
      <circle cx="12" cy="12" r="9.84" stroke="#1C2B33" strokeWidth="1.4" strokeDasharray="2 6" />
      <path
        d="M8.16 13.44a3.84 3.84 0 1 1 7.68 0H8.16Z"
        fill={tokens.coral}
        stroke="#1C2B33"
        strokeWidth="2"
      />
      <path d="M7.2 13.44h9.6" stroke="#1C2B33" strokeWidth="2" />
      <circle cx="12" cy="9.6" r="1.92" fill="#FFC24B" stroke="#1C2B33" strokeWidth="2" />
    </svg>
  );
}
