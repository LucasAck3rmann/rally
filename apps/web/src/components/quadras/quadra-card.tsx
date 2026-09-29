// SPDX-License-Identifier: AGPL-3.0-or-later
import Image from "next/image";
import Link from "next/link";
import type { QuadraResumo } from "@/lib/api/quadras";
import { formatarPreco } from "@/lib/formato";

export function QuadraCard({ quadra }: { quadra: QuadraResumo }) {
  const local = quadra.estabelecimento;
  const lugar = [local.bairro, local.cidade].filter(Boolean).join(" · ");
  const foto = quadra.fotos[0];

  return (
    <article className="overflow-hidden rounded-card border border-line bg-white transition-colors hover:border-ink/25">
      <Link href={`/quadras/${quadra.id}`} className="block">
        <div className="relative aspect-[4/3] bg-sand">
          {foto ? (
            <Image
              src={foto}
              alt={`Quadra ${quadra.nome}, no ${local.nome}`}
              fill
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : null}

          {quadra.aoVivo ? (
            <p className="absolute left-3 top-3 flex items-center gap-2 rounded-chip bg-ink/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white backdrop-blur">
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral"
                aria-hidden="true"
              />
              Jogo agora
            </p>
          ) : null}
        </div>

        <div className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray">
            {local.nome}
            {lugar ? ` · ${lugar}` : ""}
          </p>

          <h3 className="mt-2 font-display text-lg font-bold leading-snug text-ink">
            {quadra.nome}
          </h3>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {quadra.modalidades.map((modalidade) => (
              <li
                key={modalidade}
                className="rounded-chip border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gray"
              >
                {modalidade}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
            <p className="font-display text-xl font-extrabold leading-none text-ink">
              {formatarPreco(quadra.precoHora)}
              <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-gray">
                /hora
              </span>
            </p>

            {local.nota !== null ? (
              <p
                className="font-mono text-[11px] text-gray"
                aria-label={`Nota ${local.nota.toFixed(1)} de 5, ${local.avaliacoes} avaliações`}
              >
                <span aria-hidden="true" className="text-sun">
                  ★
                </span>{" "}
                {local.nota.toFixed(1)}{" "}
                <span aria-hidden="true" className="text-[10px]">
                  ({local.avaliacoes})
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
