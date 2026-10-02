// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatarPreco } from "@/lib/formato";
import type { Relatorio } from "@/lib/gestao/contratos";

function numero(valor: number, casas = 1): string {
  const texto = valor % 1 === 0 ? valor.toFixed(0) : valor.toFixed(casas);
  return texto.replace(".", ",");
}

/** "10/09" — a série diária não precisa do ano em cada linha. */
function diaCurto(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

export function RelatorioDaArena({
  relatorio,
  estabelecimentoId,
  urlDoCsv,
  urlDoXlsx,
}: {
  relatorio: Relatorio;
  estabelecimentoId: string;
  /** Rotas próprias da web que repassam o arquivo com a sessão do cookie. */
  urlDoCsv: string;
  urlDoXlsx: string;
}) {
  const { resumo, porMetodo, porDia, porQuadra, periodo } = relatorio;
  // Escala do gráfico: o maior dia define 100%. Fixar um máximo arbitrário
  // achataria a semana fraca e esconderia a diferença entre os dias.
  const maiorReceita = Math.max(...porDia.map((d) => d.receita), 1);

  return (
    <div className="p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
            Relatórios
          </h1>
          <p className="mt-1 text-[14px] text-gray">
            {periodo.de.split("-").reverse().join("/")} a{" "}
            {periodo.ate.split("-").reverse().join("/")} · {periodo.dias} dia
            {periodo.dias > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {/* `download` para o navegador salvar em vez de tentar exibir; o
              nome do arquivo vem do `Content-Disposition` da API. */}
          <a
            href={urlDoXlsx}
            download
            className="rounded-button bg-ink px-5 py-2.5 text-[14px] font-bold text-white
              transition hover:brightness-110"
          >
            Baixar Excel
          </a>
          <a
            href={urlDoCsv}
            download
            className="rounded-button border border-line px-5 py-2.5 text-[14px]
              font-semibold text-ink transition hover:bg-white"
          >
            CSV
          </a>
        </div>
      </header>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-card border
          border-line bg-white p-4"
      >
        <label>
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
            De
          </span>
          <input
            type="date"
            name="de"
            defaultValue={periodo.de}
            className="rounded-button border border-line px-3 py-2 text-[14px] text-ink
              outline-none focus:border-coral"
          />
        </label>
        <label>
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
            Até
          </span>
          <input
            type="date"
            name="ate"
            defaultValue={periodo.ate}
            className="rounded-button border border-line px-3 py-2 text-[14px] text-ink
              outline-none focus:border-coral"
          />
        </label>
        <button
          type="submit"
          className="h-[38px] rounded-button border border-line px-4 text-[14px]
            font-semibold text-ink transition hover:bg-bg"
        >
          Aplicar
        </button>
        <Link
          href={`/gestao/${estabelecimentoId}/relatorios`}
          className="h-[38px] px-2 text-[13px] leading-[38px] text-gray hover:text-ink"
        >
          Últimos 30 dias
        </Link>
      </form>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Recebido" valor={formatarPreco(resumo.receitaPaga)} />
        <Numero rotulo="A receber" valor={formatarPreco(resumo.receitaAReceber)} />
        <Numero
          rotulo="Ticket médio"
          // Zero diria "o ticket é zero"; o traço diz "não há o que medir".
          valor={resumo.ticketMedio === null ? "—" : formatarPreco(resumo.ticketMedio)}
        />
        <Numero
          rotulo="Ocupação"
          valor={resumo.ocupacao === null ? "—" : `${numero(resumo.ocupacao)}%`}
          apoio={
            resumo.ocupacao === null
              ? "sem horário cadastrado"
              : `${numero(resumo.horasVendidas)}h de ${numero(resumo.horasDisponiveis)}h`
          }
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section>
          <h2 className="font-display text-[19px] font-bold text-ink">
            Por método de pagamento
          </h2>
          {porMetodo.length === 0 ? (
            <p className="mt-4 text-[13px] text-gray">Nenhuma venda no período.</p>
          ) : (
            <table className="mt-4 w-full">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="pb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                    Método
                  </th>
                  <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                    Reservas
                  </th>
                  <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                    Valor
                  </th>
                  <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {porMetodo.map((m) => (
                  <tr key={m.metodo} className="border-b border-line/60">
                    <td className="py-2.5 text-[14px] font-semibold text-ink">
                      {m.metodo}
                    </td>
                    <td className="py-2.5 text-right text-[14px] text-gray">
                      {m.reservas}
                    </td>
                    <td className="py-2.5 text-right text-[14px] font-semibold text-ink">
                      {formatarPreco(m.valor)}
                    </td>
                    <td className="py-2.5 text-right text-[14px] text-gray">
                      {m.participacao === null ? "—" : `${numero(m.participacao)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mt-8 font-display text-[19px] font-bold text-ink">
            Por quadra
          </h2>
          <ul className="mt-4 space-y-2">
            {porQuadra.map((q) => (
              <li
                key={q.quadraId}
                className="flex items-center justify-between gap-3 border-b
                  border-line/60 pb-2 text-[14px]"
              >
                <span className="min-w-0 truncate text-ink">{q.nome}</span>
                <span className="shrink-0 text-gray">
                  {q.reservas} · {numero(q.horas)}h
                </span>
                <span
                  className={cn(
                    "shrink-0 font-semibold",
                    q.reservas === 0 ? "text-gray" : "text-ink",
                  )}
                >
                  {formatarPreco(q.receita)}
                </span>
              </li>
            ))}
            {porQuadra.length === 0 ? (
              <li className="text-[13px] text-gray">Nenhuma quadra ativa.</li>
            ) : null}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-[19px] font-bold text-ink">Dia por dia</h2>
          <p className="mt-1 text-[13px] text-gray">
            {/* O dia vazio é o achado: um gráfico que pula a quarta morta
                mente sobre a forma da semana. */}
            Dia sem movimento aparece zerado, de propósito.
          </p>
          <ul className="mt-4 space-y-1.5">
            {porDia.map((d) => (
              <li key={d.data} className="flex items-center gap-3">
                <span className="w-[46px] shrink-0 font-mono text-[11px] text-gray">
                  {diaCurto(d.data)}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2.5 shrink-0 rounded-full bg-coral"
                  style={{
                    width: `${Math.max(2, (d.receita / maiorReceita) * 100)}%`,
                    opacity: d.receita === 0 ? 0.25 : 1,
                  }}
                />
                <span className="shrink-0 text-[12px] text-gray">
                  {d.reservas === 0
                    ? "—"
                    : `${formatarPreco(d.receita)} · ${d.reservas}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Declarado em vez de escondido: o RF-28 pede CSV, XLSX e PDF. Os
          dois primeiros existem; o PDF não. */}
      <p className="mt-10 text-[13px] text-gray">
        O Excel traz números e datas como valores — soma e gera gráfico sem
        converter nada. O CSV é o formato simples, para importar em outro
        sistema. <strong>PDF ainda não está pronto.</strong>
      </p>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  apoio,
}: {
  rotulo: string;
  valor: string;
  apoio?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-white px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
        {rotulo}
      </p>
      <p className="mt-2 font-display text-[22px] font-bold leading-none text-ink">
        {valor}
      </p>
      {apoio ? <p className="mt-1.5 text-[11px] text-gray">{apoio}</p> : null}
    </div>
  );
}
