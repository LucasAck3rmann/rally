"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";
import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Rolagem suave (Lenis) — DESIGN.md §Movimento. Quem pediu menos movimento no
 * sistema fica com a rolagem nativa: o Lenis nem chega a ser montado.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduzido = useReducedMotion();

  if (reduzido) return <>{children}</>;

  return (
    <ReactLenis root options={{ lerp: 0.12, duration: 1.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
