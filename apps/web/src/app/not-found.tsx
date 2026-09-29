// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/link-button";
import { SectionLabel } from "@/components/ui/section-label";

export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <Header />

      <main id="conteudo" className="pt-16">
        <Container className="py-24 text-center lg:py-32">
          <SectionLabel index="404">Fora da quadra</SectionLabel>
          <h1 className="mx-auto mt-6 max-w-2xl font-display text-[36px] font-extrabold leading-[1.08] tracking-tight text-ink sm:text-[52px]">
            Essa bola saiu.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-gray">
            A página que você procurou não existe — ou a quadra saiu da vitrine.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <LinkButton href="/quadras">Ver quadras</LinkButton>
            <LinkButton href="/" variant="secondary">
              Voltar ao início
            </LinkButton>
          </div>
        </Container>
      </main>

      <Footer />
    </>
  );
}
