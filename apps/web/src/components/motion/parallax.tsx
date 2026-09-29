"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

/**
 * Parallax leve: o conteúdo desliza `distancia` px enquanto a seção cruza a
 * tela. Sutil de propósito — é acabamento, não efeito.
 */
export function Parallax({
  children,
  distancia = 60,
  className,
}: {
  children: ReactNode;
  distancia?: number;
  className?: string;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const reduzido = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: alvo,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distancia, -distancia]);

  return (
    <div ref={alvo} className={className}>
      <motion.div style={reduzido ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}
