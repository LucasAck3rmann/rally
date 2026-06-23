---
name: Rally Design System
product: Rally — gestão e agendamento de quadras de areia
tone: [vibrante, esportivo, próximo, confiável]
color:
  primary: "#FF6B4A"       # coral — CTA e destaque
  primary_deep: "#C2410C"  # links/texto de destaque em fundo claro (AA)
  secondary: "#0FB5AE"     # teal
  accent: "#FFC24B"        # sun
  surface: "#FFFFFF"
  background: "#FFF7EE"
  sand: "#F4E4CD"
  ink: "#1C2B33"           # texto / superfícies escuras / texto sobre coral
  muted: "#6B7785"
  line: "#ECE3D5"
typography:
  display: { family: Sora, weights: [SemiBold, Bold, ExtraBold], use: "títulos, marca, preços" }
  body:    { family: Inter, weights: [Regular, Medium, "Semi Bold", Bold], use: "corpo, UI, botões" }
  mono:    { family: Space Mono, weights: [Regular, Bold], use: "rótulos, metadados, números (CAIXA ALTA)" }
  scale_px: [11, 12, 13, 14, 15, 17, 20, 24, 32, 46]
  line_height: 1.3
radius_px:  { chip: 20, button: 12, card: 18, surface: 24 }
spacing_px: { base: 4, screen_padding: 20, card_gap: 14, card_padding: 14 }
icons:      { style: line/outline, stroke: 2, linecap: round, grid: 24 }
elevation:  { card: "y8 blur20 rgba(0,0,0,.07)" }
components:
  button:
    primary:   { bg: primary, text: ink }    # nunca texto branco sobre coral
    dark:      { bg: ink, text: surface }
    secondary: { bg: surface, border: line, text: ink }
  chip:
    active:   { bg: primary, text: ink }
    inactive: { bg: surface, border: line, text: ink }
accessibility: { target: "WCAG AA", min_touch_px: 44 }
---

# Rally — DESIGN.md

## Marca e tom
Rally é a plataforma das quadras de areia (beach tennis, futevôlei, vôlei). A voz é
**vibrante, esportiva e próxima** ("bora jogar"), mas o lado de gestão é **confiável**.
Equilibre energia (cliente) com clareza (dono).

## Cor — quando usar
- **Coral (primary)** só para o que importa: CTA principal, item ativo, destaque. Não floode a tela de coral.
- Texto/ênfase sobre fundo claro: use **primary_deep** (#C2410C), nunca o coral puro em texto pequeno.
- **Teal** = apoio; **sun** = fidelidade/promoção; **sand/background** = superfícies; **ink** = texto e superfícies escuras.

## Tipografia
Três fontes: **Sora** em títulos/nomes/preços; **Inter** no corpo/UI; **Space Mono** em rótulos,
metadados e números (CAIXA ALTA, tracking leve). Nunca a tela inteira em Inter. Regra: `fontSize >= 15` e ênfase → Sora.

## Botões — estados
- **Primário** = coral com texto **ink** (passa AA). **Escuro** = ink com texto branco. **Secundário** = branco com borda `line`.
- Botão sobre fundo coral deve ser **escuro** (ink/branco), nunca coral sobre coral.

## Fotos
Áreas de imagem usam **foto real** de quadra de areia, nunca gradiente multicolor chapado.
Gradiente só como overlay sutil para legibilidade. A **ilustração própria** (emblema) é marca/acento, não conteúdo.

## Movimento (no código)
Scroll suave **Lenis**; reveals/parallax/hover **Framer Motion**; **marquee** de texto;
**galeria** com drag-scroll; micro-rotação em stickers/botões. Respeitar `prefers-reduced-motion`.

## Ícones
Linha/outline, traço 2px, cantos arredondados, monocromáticos (cor = token). Filled só na estrela de nota.

## Nunca
- ❌ Texto branco sobre coral (#FF6B4A) — falha de contraste; use **ink**.
- ❌ Gradiente colorido como fundo de imagem.
- ❌ Hex fora da paleta.
- ❌ Só Inter; ❌ ícones preenchidos genéricos; ❌ alvo de toque < 44px.
