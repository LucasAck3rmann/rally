// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { cn } from "@/lib/cn";
import "./globals.css";

// Três famílias, como manda o DESIGN.md: Sora no display, Inter no corpo e
// Space Mono nos rótulos/números. Carregadas pelo next/font (self-host, sem
// requisição a terceiros e sem layout shift).
//
// Os arquivos ficam versionados em ./fonts, e não vêm do `next/font/google`:
// aquele loader **baixa** o woff2 de cada família durante o build, de modo que
// uma intermitência de rede reprova o build inteiro. Foi o que derrubou a
// primeira tentativa da CI do #123, em `pnpm build`. O self-host sempre foi do
// resultado; agora o processo também não fala com fonts.googleapis.com.
//
// Sora e Inter são fontes variáveis: o Google serve **um** woff2 por família
// para todos os pesos, e o intervalo declarado abaixo é o que a interface usa.
// Space Mono não é variável, então vem em dois arquivos estáticos.
const display = localFont({
  src: "./fonts/sora/sora-latin-variable.woff2",
  weight: "600 800",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

const corpo = localFont({
  src: "./fonts/inter/inter-latin-variable.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-body",
  display: "swap",
});

const mono = localFont({
  src: [
    { path: "./fonts/space-mono/space-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-mono/space-mono-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const descricao =
  "Agenda em tempo real, pagamento no Pix e replays dos jogos: a plataforma " +
  "de gestão e agendamento para quadras de areia (beach tennis, futevôlei e vôlei).";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rally — do agendamento ao replay",
    template: "%s · Rally",
  },
  description: descricao,
  applicationName: "Rally",
  authors: [{ name: "Lucas Ackermann" }],
  keywords: [
    "quadra de areia",
    "beach tennis",
    "futevôlei",
    "vôlei de praia",
    "agendamento de quadras",
    "gestão de quadras",
    "reserva de quadra",
    "pagamento pix",
    "replay",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Rally",
    title: "Rally — do agendamento ao replay",
    description: descricao,
  },
  twitter: {
    card: "summary_large_image",
    title: "Rally — do agendamento ao replay",
    description: descricao,
  },
};

export const viewport: Viewport = {
  themeColor: "#FFF7EE",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={cn(display.variable, corpo.variable, mono.variable)}>
      <body className="font-body antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-button focus:bg-ink focus:px-4 focus:py-3 focus:text-white"
        >
          Pular para o conteúdo
        </a>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
