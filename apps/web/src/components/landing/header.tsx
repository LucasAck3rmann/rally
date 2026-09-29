// SPDX-License-Identifier: AGPL-3.0-or-later
import { Container } from "@/components/ui/container";
import { Emblem } from "@/components/ui/emblem";
import { LinkButton } from "@/components/ui/link-button";

const secoes = [
  { href: "#recursos", rotulo: "Recursos" },
  { href: "#como-funciona", rotulo: "Como funciona" },
  { href: "#precos", rotulo: "Preços" },
  { href: "#faq", rotulo: "Dúvidas" },
];

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/80 bg-bg/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="#inicio" className="flex items-center gap-2.5" aria-label="Rally, início">
          <Emblem className="h-7 w-7" />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">Rally</span>
        </a>

        <nav aria-label="Seções da página" className="hidden lg:block">
          <ul className="flex items-center gap-8 font-mono text-[11px] uppercase tracking-[0.18em] text-gray">
            {secoes.map((secao) => (
              <li key={secao.href}>
                <a href={secao.href} className="transition-colors hover:text-ink">
                  {secao.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <LinkButton href="#comecar" className="shrink-0">
          Começar grátis
        </LinkButton>
      </Container>
    </header>
  );
}
