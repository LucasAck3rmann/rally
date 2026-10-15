// SPDX-License-Identifier: Apache-2.0
// Tokens do design system Rally — fonte única (ver DESIGN.md na raiz).
//
// `coralDeep` e `gray` foram escurecidos em 30/09 por contraste (RNF-08,
// WCAG 2.2 AA). Os valores antigos falhavam em pares que o produto usa:
// `gray` sobre `bg` dava 4,30 e sobre `sand` 4,30 — o mínimo é 4,5 — e
// `coralDeep` sobre `coralSoft` dava 4,20. O gate está em
// `apps/mobile/test/acessibilidade/contraste_test.dart`.

export const colors = {
  coral: "#FF6B4A",
  coralDeep: "#9A3412",
  teal: "#0FB5AE",
  sun: "#FFC24B",
  sand: "#F4E4CD",
  bg: "#FFF7EE",
  ink: "#1C2B33",
  gray: "#5C6671",
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
