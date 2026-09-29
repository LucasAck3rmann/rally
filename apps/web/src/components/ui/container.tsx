// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Coluna de conteúdo da landing — 1200px, com respiro de tela em mobile. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-5 md:px-8", className)}>{children}</div>
  );
}
