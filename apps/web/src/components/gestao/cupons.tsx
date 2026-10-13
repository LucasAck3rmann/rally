// SPDX-License-Identifier: AGPL-3.0-or-later
import { BotaoDeAcao } from "@/components/gestao/botao-de-acao";
import { FormularioDeCupom } from "@/components/gestao/formulario-de-cupom";

import { cn } from "@/lib/cn";
import { formatarPreco } from "@/lib/formato";
import { alternarCupom } from "@/lib/gestao/acoes";
import type { CupomDaGestao } from "@/lib/gestao/contratos";

/** "10/09/2026" a partir do ISO que a API devolve. */
function dia(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function desconto(c: CupomDaGestao): string {
  return c.tipo === "PERCENTUAL"
    ? `${c.valor.toString().replace(".", ",")}%`
    : formatarPreco(c.valor);
}

/**
 * Por que o cupom não está valendo — ou `null` quando está.
 *
 * Um cupom desligado, um vencido e um esgotado parecem a mesma coisa numa
 * lista que só mostra "inativo", e levam a ações diferentes: religar,
 * estender a validade, aumentar o teto.
 */
function porQueNaoVale(c: CupomDaGestao): string | null {
  if (c.vigente) return null;
  if (!c.ativo) return "Desligado";
  if (c.vencido) return "Vencido";
  if (c.esgotado) return "Esgotado";
  return "Ainda não começou";
}

export function CuponsDaArena({
  cupons,
  estabelecimentoId,
  podeEditar,
}: {
  cupons: CupomDaGestao[];
  estabelecimentoId: string;
  /** O servidor decide de novo; isto só evita mostrar o que ele recusaria. */
  podeEditar: boolean;
}) {
  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Cupons
        </h1>
        <p className="mt-1 max-w-[62ch] text-[14px] text-gray">
          O cliente digita o código na hora de reservar. Cupom não soma com o
          desconto do Pix: vale o maior dos dois.
        </p>
      </header>

      {podeEditar ? (
        <FormularioDeCupom estabelecimentoId={estabelecimentoId} />
      ) : null}

      {cupons.length === 0 ? (
        <p className="mt-8 text-[14px] text-gray">
          Nenhum cupom ainda. O primeiro costuma ser um desconto para o horário
          que fica vazio no meio da semana.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {cupons.map((c) => {
            const motivo = porQueNaoVale(c);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card
                  border border-line bg-white px-5 py-4"
              >
                <div className="min-w-[160px] flex-1">
                  <p className="font-mono text-[15px] font-bold tracking-[0.06em] text-ink">
                    {c.codigo}
                  </p>
                  <p className="mt-0.5 text-[13px] text-gray">
                    {desconto(c)} · {dia(c.validadeInicio)} a {dia(c.validadeFim)}
                  </p>
                </div>

                <p className="text-[13px] text-gray">
                  {/* Sem teto, mostrar "3 de ∞" seria ruído: o que importa é
                      quantas vezes rodou. */}
                  {c.usosMax === null
                    ? `${c.usosFeitos} uso${c.usosFeitos === 1 ? "" : "s"}`
                    : `${c.usosFeitos} de ${c.usosMax}`}
                </p>

                <span
                  className={cn(
                    "rounded-button px-2.5 py-1 text-[12px] font-semibold",
                    motivo === null
                      ? "bg-coral/15 text-coral-deep"
                      : "bg-bg text-gray",
                  )}
                >
                  {motivo ?? "Valendo"}
                </span>

                {podeEditar ? (
                  <BotaoDeAcao
                    acao={() => alternarCupom(estabelecimentoId, c.id, !c.ativo)}
                    confirmar={
                      c.ativo
                        ? `Desligar ${c.codigo}? Quem já reservou com ele não é afetado.`
                        : undefined
                    }
                    className="!px-3 !py-1.5 !text-[13px]"
                  >
                    {c.ativo ? "Desligar" : "Religar"}
                  </BotaoDeAcao>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Declarado em vez de escondido: o cupom usado é a origem do desconto
          de uma reserva paga, e apagá-lo deixaria um preço sem explicação. */}
      <p className="mt-8 text-[13px] text-gray">
        Cupom não se apaga, se desliga — ele é a origem do desconto das
        reservas que já usaram, e some do relatório junto.
      </p>
    </div>
  );
}
