"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";
import fotoArenaBeach from "@/assets/fotos/quadra-arena-beach.png";
import fotoVilaVolei from "@/assets/fotos/quadra-vila-volei.png";
import fotoReplay1 from "@/assets/fotos/replay-1.png";
import fotoReplay2 from "@/assets/fotos/replay-2.png";
import fotoReplay3 from "@/assets/fotos/replay-3.png";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/cn";

const fotos = [
  {
    src: fotoArenaBeach,
    legenda: "Beach tennis · dupla em quadra",
    alt: "Quatro jogadores disputando um ponto de beach tennis junto à rede, com o mar ao fundo",
  },
  {
    src: fotoVilaVolei,
    legenda: "Vôlei de praia · fim de tarde",
    alt: "Quadras de areia à beira-mar com jogadores, morros verdes ao fundo",
  },
  {
    src: fotoReplay1,
    legenda: "Aula · cesto de bolas",
    alt: "Cesto com bolas de beach tennis na areia e um professor ao lado",
  },
  {
    src: fotoReplay2,
    legenda: "Raquetes de frescobol",
    alt: "Duas raquetes de madeira e uma bola apoiadas na areia",
  },
  {
    src: fotoReplay3,
    legenda: "Última partida do dia",
    alt: "Par de raquetes fincadas na areia com o mar e uma falésia ao fundo",
  },
];

/**
 * Galeria com arrasto (DESIGN.md §Movimento). O contêiner é uma região
 * rolável de verdade: teclado e leitor de tela continuam funcionando, e o
 * arrasto é só um atalho para quem usa mouse.
 */
export function Gallery() {
  const trilho = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; scroll: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  function aoPressionar(evento: PointerEvent<HTMLDivElement>) {
    if (evento.pointerType !== "mouse" || !trilho.current) return;
    inicio.current = { x: evento.clientX, scroll: trilho.current.scrollLeft };
    setArrastando(true);
  }

  function aoMover(evento: PointerEvent<HTMLDivElement>) {
    if (!inicio.current || !trilho.current) return;
    trilho.current.scrollLeft = inicio.current.scroll - (evento.clientX - inicio.current.x);
  }

  function aoSoltar() {
    inicio.current = null;
    setArrastando(false);
  }

  return (
    <section aria-labelledby="titulo-galeria" className="overflow-hidden">
      <Container className="pb-4 pt-20 lg:pt-28">
        <SectionLabel index="04">Na areia</SectionLabel>
        <h2
          id="titulo-galeria"
          className="mt-4 max-w-2xl font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]"
        >
          O esporte que não para de crescer.
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray">
          Beach tennis, futevôlei e vôlei de praia lotam as quadras o ano inteiro. Arraste para o
          lado.
        </p>
      </Container>

      <div
        ref={trilho}
        role="region"
        aria-label="Galeria de quadras de areia"
        tabIndex={0}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
        className={cn(
          "mt-10 flex gap-4 overflow-x-auto px-5 pb-6 md:px-8",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          arrastando ? "cursor-grabbing select-none" : "cursor-grab",
        )}
      >
        {fotos.map((foto) => (
          <figure key={foto.legenda} className="w-[248px] shrink-0 sm:w-[320px]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-card border border-line bg-sand">
              <Image
                src={foto.src}
                alt={foto.alt}
                fill
                placeholder="blur"
                draggable={false}
                sizes="(min-width: 640px) 320px, 248px"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gray">
              {foto.legenda}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
