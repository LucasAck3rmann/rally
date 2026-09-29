// SPDX-License-Identifier: AGPL-3.0-or-later
import Image from "next/image";
import fotoReplay from "@/assets/fotos/replay-destaque.png";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/cn";

const cartao = "rounded-card border border-line bg-white p-6 sm:p-7";

// Padrão fixo de propósito: dado aleatório quebraria a hidratação, e isto é
// ilustração da grade — não a agenda de verdade.
const grade = [
  "livre",
  "reservado",
  "reservado",
  "livre",
  "bloqueado",
  "livre",
  "reservado",
  "livre",
  "reservado",
  "livre",
  "livre",
  "reservado",
  "reservado",
  "livre",
  "livre",
  "bloqueado",
  "livre",
  "reservado",
  "livre",
  "livre",
  "reservado",
  "reservado",
  "livre",
  "reservado",
] as const;

const estilosDoSlot: Record<(typeof grade)[number], string> = {
  livre: "border-line bg-bg",
  reservado: "border-coral/50 bg-coral",
  bloqueado: "border-line bg-sand",
};

const legenda = [
  { rotulo: "Reservado", cor: "bg-coral" },
  { rotulo: "Livre", cor: "border border-line bg-bg" },
  { rotulo: "Bloqueado", cor: "bg-sand" },
];

const receita = [38, 52, 44, 61, 57, 73, 88];

export function Features() {
  return (
    <section id="recursos" aria-labelledby="titulo-recursos">
      <Container className="py-20 lg:py-28">
        <SectionLabel index="02">Recursos</SectionLabel>

        <h2
          id="titulo-recursos"
          className="mt-4 max-w-2xl font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]"
        >
          Tudo que a quadra precisa, <span className="text-coral-deep">sem planilha</span>.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <article className={cn(cartao, "h-full")}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">
                (01) Agenda
              </p>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">
                Agenda em tempo real
              </h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-gray">
                Grade por quadra e por dia, com bloqueio de manutenção e faixas de preço. Dois times
                nunca caem no mesmo horário: o conflito é barrado no banco, não no combinado.
              </p>

              <div aria-hidden="true" className="mt-7 grid grid-cols-8 gap-1.5">
                {grade.map((slot, i) => (
                  <span key={i} className={cn("h-7 rounded-[6px] border", estilosDoSlot[slot])} />
                ))}
              </div>

              <ul
                aria-hidden="true"
                className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-gray"
              >
                {legenda.map((item) => (
                  <li key={item.rotulo} className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-[3px]", item.cor)} />
                    {item.rotulo}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>

          <Reveal delay={0.06} className="md:col-span-2">
            <article className={cn(cartao, "flex h-full flex-col")}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">
                (02) Pagamento
              </p>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">Pix em segundos</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray">
                QR na hora e confirmação automática por webhook. Cartão fica como alternativa.
              </p>
              <div className="mt-auto pt-8">
                <p className="font-display text-[34px] font-extrabold leading-none text-ink">
                  R$ 120,00
                </p>
                <p className="mt-3 inline-flex rounded-chip bg-sun px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
                  −5% no Pix
                </p>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.06} className="md:col-span-3">
            <article className="relative h-full min-h-[280px] overflow-hidden rounded-card border border-ink/20 bg-ink">
              <Image
                src={fotoReplay}
                alt="Jogador de beach tennis visto de cima, segurando a raquete na quadra"
                fill
                placeholder="blur"
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover opacity-40"
              />
              <div className="relative flex h-full flex-col justify-end p-6 sm:p-7">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">
                  (03) Diferencial
                </p>
                <h3 className="mt-4 font-display text-2xl font-bold text-white">
                  Os melhores pontos viram vídeo
                </h3>
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/80">
                  O replay da partida chega vinculado à reserva — o jogador assiste, baixa e
                  compartilha. É o que faz a quadra aparecer no story de quem jogou.
                </p>
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.12} className="md:col-span-3">
            <article className={cn(cartao, "flex h-full flex-col")}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">
                (04) Financeiro
              </p>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">
                Receita e ocupação no claro
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray">
                Ticket médio, horários de pico, método de pagamento e receita por modalidade — com
                exportação em CSV.
              </p>
              <div aria-hidden="true" className="mt-auto flex h-24 items-end gap-2 pt-8">
                {receita.map((altura, i) => (
                  <span
                    key={i}
                    style={{ height: `${altura}%` }}
                    className={cn(
                      "flex-1 rounded-t-[4px]",
                      i === receita.length - 1 ? "bg-coral" : "bg-ink/15",
                    )}
                  />
                ))}
              </div>
            </article>
          </Reveal>

          <Reveal delay={0.12} className="md:col-span-3">
            <article className={cn(cartao, "h-full")}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">
                (05) Vitrine
              </p>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">
                Página pública da quadra
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray">
                Fotos, comodidades, avaliações e horários livres num link só — o mesmo que você cola
                na bio do Instagram. Quem abre, já reserva.
              </p>
            </article>
          </Reveal>

          <Reveal delay={0.18} className="md:col-span-3">
            <article className={cn(cartao, "h-full")}>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-gray">(06) App</p>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">
                App próprio para quem joga
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray">
                iOS e Android: reserva em três toques, minhas reservas, replays e avisos de
                confirmação e de lembrete do jogo.
              </p>
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
