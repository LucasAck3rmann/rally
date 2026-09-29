import type { Config } from "tailwindcss";

// Tokens espelhados de packages/tokens (mantidos em sincronia — ver DESIGN.md).
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coral: "#FF6B4A",
        "coral-deep": "#C2410C",
        teal: "#0FB5AE",
        sun: "#FFC24B",
        sand: "#F4E4CD",
        bg: "#FFF7EE",
        ink: "#1C2B33",
        gray: "#6B7785",
        line: "#ECE3D5",
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
