// SPDX-License-Identifier: AGPL-3.0-or-later
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { Emblem } from "@/components/ui/emblem";
import { LinkButton } from "@/components/ui/link-button";
import { SectionLabel } from "@/components/ui/section-label";
import { REPO_URL, EMAIL_CONTATO } from "@/lib/site";

export function FinalCta() {
  return (
    <section id="comecar" aria-labelledby="titulo-comecar" className="grain bg-ink">
      <Container className="py-24 text-center lg:py-32">
        <Reveal>
          <Emblem className="mx-auto h-12 w-12" />

          <SectionLabel tone="dark" className="mt-8">
            Bora jogar
          </SectionLabel>

          <h2
            id="titulo-comecar"
            className="mx-auto mt-6 max-w-3xl font-display text-[38px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[56px] lg:text-[68px]"
          >
            Sua quadra merece uma agenda de gente grande.
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-white/75">
            Quer testar o Rally no seu espaço? Escreva para a gente — estamos escolhendo os
            primeiros estabelecimentos para rodar junto.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <LinkButton href={`mailto:${EMAIL_CONTATO}`}>Falar com a gente</LinkButton>
            <LinkButton href={REPO_URL} variant="secondary" external>
              Ver o código no GitHub
            </LinkButton>
          </div>

          <p className="mx-auto mt-10 max-w-xl font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-white/50">
            O Rally está em desenvolvimento — MVP do TCC 2026, IFSul Campus Sapiranga · Código
            aberto sob AGPL-3.0
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
