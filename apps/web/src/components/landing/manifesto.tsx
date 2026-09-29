// SPDX-License-Identifier: AGPL-3.0-or-later
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

// O "de → para" sai direto da justificativa do Projeto de Pesquisa: a gestão
// manual causa conflito de horário, retrabalho e perda de receita.
const trocas = [
  { de: "Caderno na recepção", para: "Agenda em tempo real" },
  { de: "Combinado por áudio", para: "Pix confirmado antes do jogo" },
  { de: "Achismo no fim do mês", para: "Receita e ocupação no painel" },
];

export function Manifesto() {
  return (
    <section aria-labelledby="titulo-manifesto" className="border-b border-line bg-sand/30">
      <Container className="py-20 lg:py-28">
        <SectionLabel index="01">Por que o Rally existe</SectionLabel>

        <Reveal>
          <h2
            id="titulo-manifesto"
            className="mt-7 max-w-4xl font-display text-[30px] font-bold leading-[1.18] tracking-tight text-ink sm:text-[40px] lg:text-[48px]"
          >
            A quadra vive cheia. A agenda é que{" "}
            <span className="text-coral-deep">não acompanha</span>.
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-gray">
            Caderno na recepção, print no grupo do WhatsApp, horário combinado por áudio. Funciona —
            até o dia em que dois times chegam para a mesma quadra no mesmo horário. O Rally troca
            isso por uma agenda que não deixa esse erro acontecer, um pagamento que cai antes do
            jogo e um painel que mostra quanto entrou no mês.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <dl className="mt-14 grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {trocas.map((troca) => (
              <div key={troca.de} className="py-7 md:px-7 md:first:pl-0 md:last:pr-0">
                <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray line-through decoration-coral/70">
                  {troca.de}
                </dt>
                <dd className="mt-3 font-display text-lg font-bold leading-snug text-ink">
                  {troca.para}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Container>
    </section>
  );
}
