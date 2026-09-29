// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variante = "primary" | "dark" | "secondary" | "ghost";

// Texto sobre coral é sempre ink: branco reprova no contraste (DESIGN.md).
const variantes: Record<Variante, string> = {
  primary: "bg-coral text-ink hover:brightness-[0.97]",
  dark: "bg-ink text-white hover:brightness-125",
  secondary: "border border-line bg-white text-ink hover:border-ink/25",
  ghost: "text-ink hover:bg-ink/5",
};

/**
 * CTA da landing. Tudo aqui navega (âncora, mailto ou link externo), então o
 * elemento certo é `a` — alvo de 44px para passar no RNF-08.
 */
export function LinkButton({
  href,
  children,
  variant = "primary",
  className,
  external = false,
}: {
  href: string;
  children: ReactNode;
  variant?: Variante;
  className?: string;
  external?: boolean;
}) {
  const classes = cn(
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-button px-5 py-3 text-[15px] font-semibold leading-none transition",
    variantes[variant],
    className,
  );

  // Rota interna navega pelo Link do Next; âncora, mailto e link externo são
  // `a` mesmo — o Link não acrescenta nada a eles.
  const interno = href.startsWith("/") && !external;
  if (interno) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={classes}
    >
      {children}
    </a>
  );
}
