// SPDX-License-Identifier: Apache-2.0
// Tokens do design system Rally — fonte única (ver DESIGN.md na raiz).

export const colors = {
  coral: "#FF6B4A",
  coralDeep: "#C2410C",
  teal: "#0FB5AE",
  sun: "#FFC24B",
  sand: "#F4E4CD",
  bg: "#FFF7EE",
  ink: "#1C2B33",
  gray: "#6B7785",
  line: "#ECE3D5",
  white: "#FFFFFF",
} as const;

export const radius = { chip: 20, button: 12, card: 18, surface: 24 } as const;
export const spacing = { base: 4, screen: 20, cardGap: 14, cardPadding: 14 } as const;
export const fonts = {
  display: "Sora, sans-serif",
  body: "Inter, sans-serif",
  mono: "'Space Mono', monospace",
} as const;
