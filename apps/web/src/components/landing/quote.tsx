// SPDX-License-Identifier: AGPL-3.0-or-later
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

/**
 * A citação é do próprio Projeto de Pesquisa do TCC (§5, justificativa) — nada
 * de depoimento inventado: o Rally ainda não tem cliente para citar.
 */
export function Quote() {
  return (
    <section aria-labelledby="titulo-citacao" className="grain border-y border-ink/20 bg-ink">
      <Container className="py-20 lg:py-28">
        <h2 id="titulo-citacao" className="sr-only">
          O problema que originou o projeto
        </h2>
        <SectionLabel tone="dark">A origem</SectionLabel>

        <Reveal>
          <blockquote className="mt-8 max-w-4xl">
            <p className="font-display text-[26px] font-semibold leading-[1.25] tracking-tight text-white sm:text-[36px] lg:text-[44px]">
              <span aria-hidden="true" className="text-coral">
                “
              </span>
              A gestão manual das quadras — papel e WhatsApp — causa conflito de horário,
              retrabalho, perda de receita e ausência de dados.
              <span aria-hidden="true" className="text-coral">
                ”
              </span>
            </p>
            {/* `cite` em vez de `footer`: a atribuição é o título de um
                documento, e footer aqui disputaria o papel de contentinfo
                com o rodapé da página. */}
            <p className="mt-8">
              <cite className="font-mono text-[11px] uppercase not-italic tracking-[0.2em] text-white/60">
                Projeto de Pesquisa — Rally · IFSul, Campus Sapiranga · 2026
              </cite>
            </p>
          </blockquote>
        </Reveal>
      </Container>
    </section>
  );
}
