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
        card: "18px",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
