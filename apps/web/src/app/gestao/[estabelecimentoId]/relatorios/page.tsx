// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Metadata } from "next";

import { RelatorioDaArena } from "@/components/gestao/relatorio";
import { hojeNaQuadra } from "@/lib/formato";
import { relatorioDoPeriodo } from "@/lib/gestao/consultas";

export const metadata: Metadata = { title: "Relatórios" };

const FORMATO = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-09-10" a partir de "2026-10-10" menos 30 dias. */
function trintaDiasAtras(ate: string): string {
  const [ano, mes, dia] = ate.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia - 29)).toISOString().slice(0, 10);
}

export default async function Relatorios({
  params,
  searchParams,
}: {
  params: Promise<{ estabelecimentoId: string }>;
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const { estabelecimentoId } = await params;
  const pedido = await searchParams;

  // Datas vêm da URL para o link ser compartilhável; fora do formato caem no
  // padrão de 30 dias em vez de virar 400.
  const hoje = hojeNaQuadra();
  const ate = pedido.ate && FORMATO.test(pedido.ate) ? pedido.ate : hoje;
  const de =
    pedido.de && FORMATO.test(pedido.de) ? pedido.de : trintaDiasAtras(ate);

  const relatorio = await relatorioDoPeriodo(estabelecimentoId, de, ate);
  const periodo = new URLSearchParams({ de, ate }).toString();

  return (
    <RelatorioDaArena
      relatorio={relatorio}
      estabelecimentoId={estabelecimentoId}
      urlDoCsv={`/gestao/${estabelecimentoId}/relatorios/csv?${periodo}`}
      urlDoXlsx={`/gestao/${estabelecimentoId}/relatorios/xlsx?${periodo}`}
      urlDoPdf={`/gestao/${estabelecimentoId}/relatorios/pdf?${periodo}`}
    />
  );
}
