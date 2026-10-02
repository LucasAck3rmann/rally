import { colors as tokens } from "@rally/tokens";
import type { Config } from "tailwindcss";

// As cores vêm **importadas** de packages/tokens, não copiadas.
//
// Até 30/09 este arquivo repetia os hexes à mão com um comentário dizendo
// "mantidos em sincronia". Não estavam: o PR #62 escureceu `coralDeep` e
// `gray` por contraste (RNF-08) e a web continuou renderizando os valores
// reprovados, porque ninguém edita dois arquivos para mudar uma cor.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coral: tokens.coral,
        "coral-deep": tokens.coralDeep,
        teal: tokens.teal,
        sun: tokens.sun,
        sand: tokens.sand,
        bg: tokens.bg,
        ink: tokens.ink,
        gray: tokens.gray,
        line: tokens.line,
      },
      borderRadius: {
        chip: "20px",
        button: "12px",
        card: "18px",
        surface: "24px",
      },
      // As famílias vêm do next/font (ver src/app/layout.tsx); o fallback
      // mantém a tela legível se a fonte não carregar.
      fontFamily: {
        display: ["var(--font-display)", "Sora", "sans-serif"],
        body: ["var(--font-body)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "Space Mono", "monospace"],
      },
      // Elevação só onde o filete não resolve (selos flutuantes) — DESIGN.md.
      boxShadow: { card: "0 8px 20px rgba(0, 0, 0, 0.07)" },
      keyframes: {
        // A faixa tem duas cópias do conteúdo: -50% reinicia sem emenda.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: { marquee: "marquee 45s linear infinite" },
    },
  },
  plugins: [],
} satisfies Config;
