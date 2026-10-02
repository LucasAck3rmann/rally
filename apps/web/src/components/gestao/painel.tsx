// SPDX-License-Identifier: AGPL-3.0-or-later
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatarPreco } from "@/lib/formato";
import type { Painel } from "@/lib/gestao/contratos";

/** "14" em vez de "14.0"; "14,3" em vez de "14.3". */
function numero(valor: number): string {
  const texto = valor % 1 === 0 ? valor.toFixed(0) : valor.toFixed(1);
  return texto.replace(".", ",");
}

export function PainelDaArena({
  painel,
  dias,
  periodos,
  estabelecimentoId,
}: {
  painel: Painel;
  dias: number;
  periodos: number[];
  estabelecimentoId: string;
}) {
  const semMovimento =
    painel.reservas.vendidas === 0 &&
    painel.reservas.canceladas === 0 &&
    painel.proximosJogos.length === 0;

  return (
    <div className="p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
            Painel
          </h1>
          <p className="mt-1 text-[14px] text-gray">Como está indo a arena</p>
        </div>
        <nav aria-label="Período" className="flex gap-2">
          {periodos.map((p) => (
            <Link
              key={p}
              href={`/gestao/${estabelecimentoId}?dias=${p}`}
              aria-current={p === dias ? "page" : undefined}
              className={cn(
                "rounded-chip border px-4 py-2 text-[13px] transition",
                p === dias
                  ? "border-coral bg-coral font-semibold text-ink"
                  : "border-line bg-white text-gray hover:text-ink",
              )}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </header>

      {semMovimento ? (
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Nenhum movimento no período. Quando entrarem reservas, os números
          aparecem aqui.
        </p>
      ) : (
        <>
          <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
            <Receita receita={painel.receita} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Metrica
                valor={
                  painel.ocupacao.percentual === null
                    ? "—"
                    : `${numero(painel.ocupacao.percentual)}%`
                }
                rotulo="ocupação"
                apoio={
                  // Sem horário de funcionamento não há denominador; "0%"
                  // afirmaria que a arena está vazia.
                  painel.ocupacao.percentual === null
                    ? "sem horário cadastrado"
                    : `${numero(painel.ocupacao.horasVendidas)}h de ${numero(
                        painel.ocupacao.horasDisponiveis,
                      )}h`
                }
              />
              <Metrica
                valor={String(painel.reservas.vendidas)}
                rotulo="reservas"
                apoio={
                  painel.reservas.bloqueios === 0
                    ? undefined
                    : `${painel.reservas.bloqueios} bloqueio${
                        painel.reservas.bloqueios > 1 ? "s" : ""
                      }`
                }
              />
              <Metrica
                valor={
                  painel.reservas.taxaCancelamento === null
                    ? "—"
                    : `${numero(painel.reservas.taxaCancelamento)}%`
                }
                rotulo="cancelamento"
                apoio={
                  painel.reservas.canceladas === 0
                    ? undefined
                    : `${painel.reservas.canceladas} cancelada${
                        painel.reservas.canceladas > 1 ? "s" : ""
                      }`
                }
              />
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="font-display text-[19px] font-bold text-ink">Por quadra</h2>
              <ul className="mt-4 space-y-2.5">
                {painel.porQuadra.map((q) => (
                  <li
                    key={q.quadraId}
                    className="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[15px] font-bold text-ink">
                        {q.nome}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-gray">
                        {q.reservas === 0
                          ? // Quadra parada aparece em vez de sumir: é
                            // justamente ela que o dono precisa ver.
                            "Nenhuma reserva no período"
                          : `${q.reservas} reserva${q.reservas > 1 ? "s" : ""}${
                              q.ocupacao === null
                                ? ""
                                : ` · ${numero(q.ocupacao)}% de ocupação`
                            }`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "font-display text-[15px] font-bold",
                        q.reservas === 0 ? "text-gray" : "text-ink",
                      )}
                    >
                      {formatarPreco(q.receita)}
                    </span>
                  </li>
                ))}
                {painel.porQuadra.length === 0 ? (
                  <li className="text-[13px] text-gray">Nenhuma quadra ativa.</li>
                ) : null}
              </ul>
            </section>

            <section>
              <h2 className="font-display text-[19px] font-bold text-ink">
                Próximos jogos
              </h2>
              <ul className="mt-4 space-y-2.5">
                {painel.proximosJogos.map((j) => (
                  <li
                    key={j.id}
                    className="flex items-center gap-4 rounded-card border border-line bg-white px-4 py-3"
                  >
                    <span className="font-display text-[15px] font-bold text-ink">
                      {j.horaInicio}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">
                        {/* Reserva sem cliente é de balcão, não um nome em branco. */}
                        {j.clienteNome ?? "Reserva de balcão"}
                      </p>
                      <p className="truncate text-[12px] text-gray">{j.quadraNome}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-chip px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em]",
                        j.pago ? "bg-sand text-ink" : "bg-coral/10 text-coral-deep",
                      )}
                    >
                      {j.pago ? "Pago" : "A pagar"}
                    </span>
                  </li>
                ))}
                {painel.proximosJogos.length === 0 ? (
                  <li className="text-[13px] text-gray">
                    Nada agendado daqui para frente.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** O card do dinheiro. Caixa e a receber ficam separados de propósito. */
function Receita({ receita }: { receita: Painel["receita"] }) {
  return (
    <div className="rounded-card bg-ink p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
        Recebido no período
      </p>
      <p className="mt-2 font-display text-[36px] font-bold leading-none text-white">
        {formatarPreco(receita.paga)}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <ParDoCard rotulo="A receber" valor={formatarPreco(receita.aReceber)} />
        <ParDoCard
          rotulo="Ticket médio"
          // Zero diria "o ticket é zero"; o traço diz "não há o que medir".
          valor={receita.ticketMedio === null ? "—" : formatarPreco(receita.ticketMedio)}
        />
      </div>
    </div>
  );
}

function ParDoCard({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-white/60">
        {rotulo}
      </p>
      <p className="mt-1 truncate font-display text-[17px] font-bold text-white">{valor}</p>
    </div>
  );
}

function Metrica({
  valor,
  rotulo,
  apoio,
}: {
  valor: string;
  rotulo: string;
  apoio?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-4">
      <p className="font-display text-[24px] font-bold leading-none text-ink">{valor}</p>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-gray">
        {rotulo}
      </p>
      {apoio ? <p className="mt-1 text-[11px] text-gray">{apoio}</p> : null}
    </div>
  );
}
