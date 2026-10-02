// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatarPreco, rotuloDoDia } from "@/lib/formato";
import type { AgendaDoDia, ItemDaAgenda } from "@/lib/gestao/contratos";

/** Hora cheia em que o item começa — é como a grade indexa as linhas. */
function horaDeInicio(item: ItemDaAgenda): number {
  return Number(item.horaInicio.split(":")[0] ?? 0);
}

/** Quantas horas inteiras o item ocupa, no mínimo uma. */
function duracaoEmHoras(item: ItemDaAgenda): number {
  const minutos =
    (new Date(item.fim).getTime() - new Date(item.inicio).getTime()) / 60000;
  return Math.max(1, Math.ceil(minutos / 60));
}

/**
 * O que ocupa exatamente esta hora nesta quadra.
 *
 * Compara por **intervalo** e não por hora de início: uma reserva de duas
 * horas ocupa a segunda hora sem começar nela, e uma grade que só olha o
 * início mostraria aquela célula como livre.
 */
function em(agenda: AgendaDoDia, quadraId: string, hora: number) {
  return agenda.itens.find((item) => {
    if (item.quadraId !== quadraId) return false;
    const comeca = horaDeInicio(item);
    return hora >= comeca && hora < comeca + duracaoEmHoras(item);
  });
}

/**
 * Faixa de horas que a grade desenha.
 *
 * Parte de 8h–22h e só cresce para caber o que existe: começar em 00h
 * deixaria o dono rolando oito linhas vazias antes do primeiro jogo, e
 * cortar em 22h esconderia o jogo das 23h.
 */
function faixaDeHoras(agenda: AgendaDoDia): number[] {
  let primeira = 8;
  let ultima = 22;
  for (const item of agenda.itens) {
    const comeca = horaDeInicio(item);
    const termina = comeca + duracaoEmHoras(item) - 1;
    if (comeca < primeira) primeira = comeca;
    if (termina > ultima) ultima = termina;
  }
  return Array.from({ length: ultima - primeira + 1 }, (_, i) => primeira + i);
}

export function AgendaDaArena({
  agenda,
  dias,
  estabelecimentoId,
}: {
  agenda: AgendaDoDia;
  dias: string[];
  estabelecimentoId: string;
}) {
  const horas = faixaDeHoras(agenda);

  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Agenda
        </h1>
        <p className="mt-1 text-[14px] text-gray">
          O dia inteiro, quadra a quadra
        </p>
      </header>

      <nav aria-label="Dia" className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {dias.map((dia) => (
          <Link
            key={dia}
            href={`/gestao/${estabelecimentoId}/agenda?data=${dia}`}
            aria-current={dia === agenda.data ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-chip border px-4 py-2 text-[13px] transition",
              dia === agenda.data
                ? "border-coral bg-coral font-semibold text-ink"
                : "border-line bg-white text-gray hover:text-ink",
            )}
          >
            {rotuloDoDia(dia)}
          </Link>
        ))}
      </nav>

      {agenda.quadras.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Nenhuma quadra ativa. Cadastre ou reative uma quadra para ela ter
          agenda.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-1">
            {/* Tabela e não grade de `div`: a agenda **é** uma matriz de
                hora × quadra, e o leitor de tela anuncia linha e coluna de
                graça quando a estrutura diz a verdade. */}
            <caption className="sr-only">
              Agenda de {agenda.data}, horas nas linhas e quadras nas colunas
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[56px]">
                  <span className="sr-only">Hora</span>
                </th>
                {agenda.quadras.map((q) => (
                  <th
                    key={q.id}
                    scope="col"
                    className="px-2 pb-2 font-display text-[13px] font-bold text-ink"
                  >
                    {q.nome}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horas.map((hora) => (
                <tr key={hora}>
                  <th
                    scope="row"
                    className="align-top font-mono text-[11px] font-normal text-gray"
                  >
                    {String(hora).padStart(2, "0")}h
                  </th>
                  {agenda.quadras.map((q) => (
                    <Celula
                      key={q.id}
                      item={em(agenda, q.id, hora)}
                      hora={hora}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Celula({ item, hora }: { item?: ItemDaAgenda; hora: number }) {
  if (!item) {
    return (
      <td className="h-14 rounded-button border border-line bg-white px-2 align-middle">
        <span className="sr-only">{hora}h livre</span>
      </td>
    );
  }

  // Reserva de duas horas desenha só na primeira linha; a segunda fica como
  // continuação, sem repetir o card.
  const continuacao = horaDeInicio(item) !== hora;
  if (continuacao) {
    return (
      <td className="h-14 rounded-button border border-line bg-sand px-2 align-middle">
        <span className="sr-only">Continuação de {item.horaInicio}</span>
      </td>
    );
  }

  return (
    <td
      className={cn(
        "h-14 rounded-button border px-2 align-middle",
        item.ehBloqueio
          ? "border-coral/20 bg-coral/10"
          : "border-line bg-sand",
      )}
    >
      <p
        className={cn(
          "truncate text-[12px] font-bold",
          item.ehBloqueio ? "text-coral-deep" : "text-ink",
        )}
      >
        {item.ehBloqueio ? "Bloqueado" : (item.cliente?.nome ?? "Reserva")}
      </p>
      <p className="truncate text-[11px] text-gray">
        {item.ehBloqueio
          ? (item.motivo ?? item.horaInicio)
          : item.preco === null
            ? item.horaInicio
            : formatarPreco(item.preco)}
      </p>
    </td>
  );
}
