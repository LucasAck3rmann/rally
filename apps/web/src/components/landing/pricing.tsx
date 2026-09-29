// SPDX-License-Identifier: AGPL-3.0-or-later
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/link-button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/cn";

// Os três planos são os do RF-33 (Free/Pro/Clube). Os valores são de
// lançamento e ainda estão em validação — por isso a nota abaixo da grade.
const planos = [
  {
    nome: "Free",
    preco: "R$ 0",
    periodo: "para sempre",
    resumo: "Para quem tem uma quadra e quer sair do caderno hoje.",
    itens: [
      "1 quadra",
      "Agenda e reservas online",
      "Página pública da quadra",
      "Pix (taxa do gateway)",
    ],
    destaque: false,
  },
  {
    nome: "Pro",
    preco: "R$ 149",
    periodo: "por mês",
    resumo: "Para o espaço que vive cheio e precisa enxergar o caixa.",
    itens: [
      "Quadras ilimitadas",
      "Financeiro e relatórios (CSV)",
      "Promoções e cupons",
      "Equipe com papéis e permissões",
      "Lembretes de jogo",
    ],
    destaque: true,
  },
  {
    nome: "Clube",
    preco: "Sob consulta",
    periodo: "",
    resumo: "Para clube, franquia ou quem quer os replays rodando.",
    itens: [
      "Tudo do Pro",
      "Replays dos jogos",
      "Várias unidades",
      "Jogadores, times e mensalidades",
    ],
    destaque: false,
  },
];

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-4 w-4 shrink-0 text-coral-deep"
    >
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pricing() {
  return (
    <section id="precos" aria-labelledby="titulo-precos">
      <Container className="py-20 lg:py-28">
        <SectionLabel index="05">Planos</SectionLabel>

        <h2
          id="titulo-precos"
          className="mt-4 max-w-2xl font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]"
        >
          Comece de graça. <span className="text-coral-deep">Cresça quando lotar</span>.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {planos.map((plano, i) => (
            <Reveal key={plano.nome} delay={i * 0.06}>
              <article
                className={cn(
                  "flex h-full flex-col rounded-card border p-7",
                  plano.destaque ? "border-ink bg-white" : "border-line bg-white",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-gray">
                    {plano.nome}
                  </h3>
                  {plano.destaque ? (
                    <span className="rounded-chip bg-coral px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
                      Recomendado
                    </span>
                  ) : null}
                </div>

                <p className="mt-6 font-display text-[38px] font-extrabold leading-none tracking-tight text-ink">
                  {plano.preco}
                </p>
                {plano.periodo ? (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-gray">
                    {plano.periodo}
                  </p>
                ) : null}

                <p className="mt-5 text-[15px] leading-relaxed text-gray">{plano.resumo}</p>

                <ul className="mt-7 flex flex-col gap-3 border-t border-line pt-7 text-[15px] text-ink">
                  {plano.itens.map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check />
                      {item}
                    </li>
                  ))}
                </ul>

                <LinkButton
                  href="#comecar"
                  variant={plano.destaque ? "primary" : "secondary"}
                  className="mt-8 w-full"
                >
                  {plano.nome === "Clube" ? "Falar com a gente" : "Começar agora"}
                </LinkButton>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-gray">
          Preços de lançamento, em validação · O Rally está em desenvolvimento (MVP do TCC 2026)
        </p>
      </Container>
    </section>
  );
}
