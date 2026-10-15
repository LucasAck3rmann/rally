// SPDX-License-Identifier: AGPL-3.0-or-later
import { BotaoDeAcao } from "@/components/gestao/botao-de-acao";
import { cn } from "@/lib/cn";
import { formatarPreco } from "@/lib/formato";
import { expirarPendentes } from "@/lib/gestao/acoes";
import type { Conciliacao } from "@/lib/gestao/contratos";

/** "ter, 05/10 · 19:00" — a divergência precisa do quando para ser achada. */
function quando(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ConciliacaoDaArena({
  conciliacao,
  estabelecimentoId,
  podeExpirar,
}: {
  conciliacao: Conciliacao;
  estabelecimentoId: string;
  /// Liberar horário escreve na agenda, e escrita de agenda é do admin.
  podeExpirar: boolean;
}) {
  const { conferidas, graves, divergencias, porTipo } = conciliacao;
  const presas = divergencias.filter((d) => d.tipo === "PENDENTE_EXPIRADA").length;

  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Conciliação
        </h1>
        <p className="mt-1 text-[14px] text-gray">
          {/* O número que importa é o de divergências, não o de conferidas —
              mas sem o denominador ninguém sabe se 3 é muito ou pouco. */}
          {conferidas} reserva{conferidas === 1 ? "" : "s"} conferida
          {conferidas === 1 ? "" : "s"} ·{" "}
          {divergencias.length === 0
            ? "nenhuma divergência"
            : `${divergencias.length} divergência${divergencias.length > 1 ? "s" : ""}`}
          {graves > 0 ? ` · ${graves} grave${graves > 1 ? "s" : ""}` : ""}
        </p>
      </header>

      {divergencias.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Todos os pares reserva e pagamento fecham. Nada a resolver.
        </p>
      ) : (
        <>
          {presas > 0 && podeExpirar ? (
            <div
              className="mt-7 flex flex-wrap items-center justify-between gap-4
                rounded-card border border-coral/30 bg-coral/5 p-5"
            >
              <div className="min-w-0">
                <p className="font-display text-[16px] font-bold text-ink">
                  {presas} horário{presas > 1 ? "s" : ""} preso
                  {presas > 1 ? "s" : ""} por Pix expirado
                </p>
                <p className="mt-1 text-[13px] text-gray">
                  {/* Dizer o que acontece: o horário volta para a venda e a
                      reserva vira cancelada, não desaparece. */}
                  Liberar devolve esses horários para a venda e marca as
                  reservas como canceladas. O histórico fica.
                </p>
              </div>
              <BotaoDeAcao
                acao={() => expirarPendentes(estabelecimentoId)}
                tom="primario"
                confirmar={`Liberar ${presas} horário${presas > 1 ? "s" : ""}? As reservas viram canceladas e os horários voltam para a venda.`}
                rotuloOcupado="Liberando…"
                className="shrink-0"
              >
                Liberar horários
              </BotaoDeAcao>
            </div>
          ) : null}

          <ul className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {porTipo.map((t) => (
              <li
                key={t.tipo}
                className={cn(
                  "rounded-card border px-5 py-4",
                  t.gravidade === "grave"
                    ? "border-coral/30 bg-white"
                    : "border-line bg-white",
                )}
              >
                <p className="font-display text-[22px] font-bold leading-none text-ink">
                  {t.quantidade}
                </p>
                <p className="mt-2 text-[13px] text-ink">{t.descricao}</p>
                <p
                  className={cn(
                    "mt-2 font-mono text-[9px] uppercase tracking-[0.2em]",
                    t.gravidade === "grave" ? "text-coral-deep" : "text-gray",
                  )}
                >
                  {t.gravidade === "grave" ? "Grave" : "Atenção"}
                </p>
              </li>
            ))}
          </ul>

          <h2 className="mt-9 font-display text-[19px] font-bold text-ink">
            Reserva por reserva
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Reserva", "Quando", "Problema", "Reserva / Cobrança", ""].map(
                    (coluna, i) => (
                      <th
                        key={coluna || i}
                        className="pb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-gray"
                      >
                        {coluna}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {divergencias.map((d) => (
                  <tr
                    key={`${d.reservaId}-${d.tipo}`}
                    className="border-b border-line/60 align-top"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-mono text-[12px] text-ink">{d.codigo}</p>
                      <p className="mt-0.5 text-[12px] text-gray">
                        {/* Reserva sem cliente é de balcão. */}
                        {d.cliente ?? "Balcão"} · {d.quadra}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-gray">
                      {quando(d.inicio)}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-[13px] text-ink">{d.descricao}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-gray">
                        {d.statusReserva}
                        {d.statusPagamento ? ` · ${d.statusPagamento}` : " · sem cobrança"}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-ink">
                      {formatarPreco(d.valorReserva)}
                      {d.valorPagamento !== null &&
                      d.valorPagamento !== d.valorReserva ? (
                        <>
                          {" / "}
                          <span className="text-coral-deep">
                            {formatarPreco(d.valorPagamento)}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "rounded-chip px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em]",
                          d.gravidade === "grave"
                            ? "bg-coral/10 text-coral-deep"
                            : "bg-sand text-ink",
                        )}
                      >
                        {d.gravidade === "grave" ? "Grave" : "Atenção"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* O que esta tela não é, dito de frente: sem credencial de gateway não
          há extrato para comparar (ADR-0013). */}
      <p className="mt-10 text-[13px] text-gray">
        A conciliação compara reserva e cobrança <strong>dentro do Rally</strong>.
        Comparar com o extrato do gateway depende das credenciais da AbacatePay,
        que ainda não estão configuradas.
      </p>
    </div>
  );
}
