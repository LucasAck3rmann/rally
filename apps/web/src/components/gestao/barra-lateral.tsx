// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { Emblem } from "@/components/ui/emblem";
import { cn } from "@/lib/cn";
import type { EstabelecimentoGerido } from "@/lib/gestao/contratos";

const SECOES = [
  { slug: "", rotulo: "Painel" },
  { slug: "agenda", rotulo: "Agenda" },
  { slug: "quadras", rotulo: "Quadras" },
  { slug: "relatorios", rotulo: "Relatórios" },
  { slug: "conciliacao", rotulo: "Conciliação" },
  { slug: "equipe", rotulo: "Equipe" },
];

export function BarraLateral({
  estabelecimentos,
}: {
  estabelecimentos: EstabelecimentoGerido[];
}) {
  const caminho = usePathname();
  const parametros = useParams<{ estabelecimentoId?: string }>();
  const atual =
    estabelecimentos.find((e) => e.id === parametros.estabelecimentoId) ??
    estabelecimentos[0];

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r
        border-line bg-white p-5 md:flex"
    >
      <Link href="/" className="mb-7 flex items-center gap-2.5">
        <Emblem className="h-7 w-7" />
        <span className="font-display text-[17px] font-bold text-ink">Rally</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray">
          gestão
        </span>
      </Link>

      {atual ? (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray">
            Arena
          </p>
          <p className="mt-1 truncate font-display text-[15px] font-bold text-ink">
            {atual.nome}
          </p>
          <p className="mt-0.5 text-[12px] text-gray">{rotuloDoPapel(atual.meuPapel)}</p>

          {/* O seletor só aparece a partir de dois: escolher entre uma
              opção não é escolha, e ocupa espaço dizendo isso. */}
          {estabelecimentos.length > 1 ? (
            <nav className="mt-3 space-y-1">
              {estabelecimentos.map((e) => (
                <Link
                  key={e.id}
                  href={`/gestao/${e.id}`}
                  className={cn(
                    "block truncate rounded-button px-3 py-2 text-[13px] transition",
                    e.id === atual.id
                      ? "bg-sand font-semibold text-ink"
                      : "text-gray hover:bg-bg hover:text-ink",
                  )}
                >
                  {e.nome}
                </Link>
              ))}
            </nav>
          ) : null}

          <nav className="mt-7 space-y-1">
            {SECOES.map((secao) => {
              const href = `/gestao/${atual.id}${secao.slug ? `/${secao.slug}` : ""}`;
              return (
                <Link
                  key={secao.rotulo}
                  href={href}
                  aria-current={caminho === href ? "page" : undefined}
                  className={cn(
                    "block rounded-button px-3 py-2.5 text-[14px] transition",
                    caminho === href
                      ? "bg-ink font-semibold text-white"
                      : "text-ink hover:bg-bg",
                  )}
                >
                  {secao.rotulo}
                </Link>
              );
            })}
          </nav>
        </>
      ) : (
        <p className="text-[13px] text-gray">
          Você ainda não gerencia nenhuma arena. Quando um estabelecimento te
          der acesso, ele aparece aqui.
        </p>
      )}

      <form action="/sair" method="post" className="mt-auto pt-6">
        <button
          type="submit"
          className="w-full rounded-button border border-line px-3 py-2.5 text-[13px]
            font-semibold text-coral-deep transition hover:bg-coral/5"
        >
          Sair
        </button>
      </form>
    </aside>
  );
}

function rotuloDoPapel(papel: EstabelecimentoGerido["meuPapel"]): string {
  return {
    ATENDENTE: "Atendente",
    FINANCEIRO: "Financeiro",
    ADMIN: "Administrador",
    MANTENEDOR: "Mantenedor",
  }[papel];
}
