// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata, Viewport } from "next";
import { Inter, Sora, Space_Mono } from "next/font/google";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { cn } from "@/lib/cn";
import "./globals.css";

// Três famílias, como manda o DESIGN.md: Sora no display, Inter no corpo e
// Space Mono nos rótulos/números. Carregadas pelo next/font (self-host, sem
// requisição a terceiros e sem layout shift).
const display = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const corpo = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
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
