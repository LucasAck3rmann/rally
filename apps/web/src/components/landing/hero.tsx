// SPDX-License-Identifier: AGPL-3.0-or-later
import Image from "next/image";
import fotoHero from "@/assets/fotos/quadra-arena-hero.png";
import { Parallax } from "@/components/motion/parallax";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/link-button";
import { SectionLabel } from "@/components/ui/section-label";

const fatos = [
  "Sem conflito de horário",
  "Pix confirmado automaticamente",
  "Código aberto · AGPL-3.0",
];

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="titulo-hero">
      <Container className="grid items-center gap-14 py-14 lg:grid-cols-12 lg:gap-12 lg:py-24">
        <div className="lg:col-span-7">
          <SectionLabel>EST. 2026 · a plataforma das quadras de areia</SectionLabel>

          <h1
            id="titulo-hero"
            className="mt-5 font-display text-[42px] font-extrabold leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-[76px]"
          >
            Do agendamento ao <span className="text-coral-deep">replay</span>.
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-gray">
            O jogador reserva a quadra e paga no Pix em segundos. Você acompanha agenda, ocupação e
            caixa num painel só. E os melhores pontos da partida viram vídeo para compartilhar.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="#comecar">Começar grátis</LinkButton>
            <LinkButton href="#como-funciona" variant="secondary">
              Ver como funciona
            </LinkButton>
          </div>

          <ul className="mt-12 grid divide-y divide-line border-y border-line font-mono text-[11px] uppercase tracking-[0.18em] text-gray sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {fatos.map((fato) => (
              <li key={fato} className="py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                {fato}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-5">
          <div className="relative">
            <Parallax distancia={24}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-surface border border-line bg-sand">
                <Image
                  src={fotoHero}
                  alt="Bola e raquetes de beach tennis sobre a areia, com a rede e jogadores ao fundo"
                  fill
                  priority
                  placeholder="blur"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </Parallax>

            <div className="absolute right-4 top-4 flex items-center gap-2 rounded-chip bg-ink/90 px-3 py-2 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-coral" aria-hidden="true" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white">
                Agenda ao vivo
              </span>
            </div>

            <div className="absolute -left-2 top-10 -rotate-[4deg] rounded-card border border-line bg-white px-4 py-3 shadow-card md:-left-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray">
                Reserva confirmada
              </p>
              <p className="mt-1 font-display text-sm font-bold text-ink">#RALLY-7K2P</p>
            </div>

            <div className="absolute -right-2 bottom-10 rotate-[3deg] rounded-card bg-coral px-4 py-3 shadow-card md:-right-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink">
                Pix · pago
              </p>
              <p className="mt-0.5 font-display text-base font-extrabold text-ink">R$ 120,00</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
