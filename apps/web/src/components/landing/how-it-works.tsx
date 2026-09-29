// SPDX-License-Identifier: AGPL-3.0-or-later
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

const passos = [
  {
    indice: "01",
    titulo: "Cadastre suas quadras",
    texto:
      "Nome, modalidades, horário de funcionamento e preço por faixa de horário. O dia a dia muda? Você ajusta pelo painel, sem pedir para ninguém.",
  },
  {
    indice: "02",
    titulo: "Receba reservas e pagamentos",
    texto:
      "Seu link público mostra a disponibilidade real. O jogador escolhe o horário, paga no Pix e o slot fecha na hora — sem chance de dois times no mesmo horário.",
  },
  {
    indice: "03",
    titulo: "Acompanhe tudo num lugar",
    texto:
      "Agenda do dia, ocupação por quadra, receita do mês e relatório para exportar. O que era planilha vira tela.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="titulo-como-funciona">
      <Container className="py-20 lg:py-28">
        <SectionLabel index="03">Como funciona</SectionLabel>

        <h2
          id="titulo-como-funciona"
          className="mt-4 max-w-2xl font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]"
        >
          Três passos entre a quadra vazia e a quadra paga.
        </h2>

        <ol className="mt-14 grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {passos.map((passo, i) => (
            <li key={passo.indice} className="py-9 md:px-8 md:first:pl-0 md:last:pr-0">
              <Reveal delay={i * 0.08}>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-coral-deep">
                  ({passo.indice})
                </p>
                <h3 className="mt-5 font-display text-xl font-bold leading-snug text-ink">
                  {passo.titulo}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-gray">{passo.texto}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
