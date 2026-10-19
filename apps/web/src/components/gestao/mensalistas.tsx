// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

/*
 * **Esta tela precisa ser Client Component, e a razao nao e interatividade.**
 *
 * Ela passa `acao={(…) => algumaAcao(…)}` para o `BotaoDeAcao`, que e Client
 * Component. Num Server Component essa seta e uma **funcao comum criada no
 * servidor**, e o Next recusa serializa-la: *"Functions cannot be passed
 * directly to Client Components"*. A pagina quebrava em tempo de execucao,
 * inteira, antes de renderizar o titulo.
 *
 * As Server Actions de `lib/gestao/acoes.ts` continuam no servidor — elas tem
 * `"use server"` e sao chamadas daqui normalmente. O que muda e **onde a seta
 * que as envolve nasce**: no cliente, onde funcao nao precisa atravessar
 * fronteira nenhuma.
 */
import { BotaoDeAcao } from "@/components/gestao/botao-de-acao";
import { FormularioDeMensalista } from "@/components/gestao/formulario-de-mensalista";
import { cn } from "@/lib/cn";
import { formatarPreco } from "@/lib/formato";
import { encerrarMensalista, materializarMensalista } from "@/lib/gestao/acoes";
import type { Mensalista, QuadraDaGestao } from "@/lib/gestao/contratos";

const DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** "Terça, 19:00 às 20:00" — o horário é o que identifica o mensalista. */
function horario(m: Mensalista): string {
  const [h, min] = m.horaInicio.split(":").map(Number);
  const fim = new Date(Date.UTC(2000, 0, 1, h, min + m.duracaoMinutos));
  const hh = String(fim.getUTCHours()).padStart(2, "0");
  const mm = String(fim.getUTCMinutes()).padStart(2, "0");
  return `${DIAS[m.diaSemana] ?? "—"}, ${m.horaInicio} às ${hh}:${mm}`;
}

/** "20/10/2026" a partir de "2026-10-20", sem passar pelo fuso. */
function data(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Quantos dias faltam até o fim do que já foi materializado.
 *
 * **É a leitura do campo que o ADR-0014 criou como mitigação medida.** Se o
 * trabalho agendado parar, as ocorrências deixam de nascer em silêncio e o
 * horário aparece livre na grade. Aqui o número fica visível antes de o
 * cliente chegar e encontrar a quadra vendida para outro.
 */
function diasDeFolga(m: Mensalista, hoje: string): number | null {
  if (!m.materializadaAte) return null;
  const ate = Date.parse(`${m.materializadaAte}T00:00:00Z`);
  const agora = Date.parse(`${hoje}T00:00:00Z`);
  return Math.round((ate - agora) / 86_400_000);
}

export function MensalistasDaArena({
  mensalistas,
  quadras,
  estabelecimentoId,
  hoje,
  podeEditar,
}: {
  mensalistas: Mensalista[];
  /** Para o cadastro escolher a quadra — ninguém digita o id de uma. */
  quadras: QuadraDaGestao[];
  estabelecimentoId: string;
  /** "YYYY-MM-DD" na hora da arena, para o cálculo de folga não usar o fuso do servidor. */
  hoje: string;
  /// Criar e encerrar mensalista ocupa e devolve horário: é escrita de agenda.
  podeEditar: boolean;
}) {
  const ativos = mensalistas.filter((m) => m.status === "ATIVA");
  const encerrados = mensalistas.filter((m) => m.status !== "ATIVA");
  const receitaSemanal = ativos.reduce((s, m) => s + m.preco, 0);

  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Mensalistas
        </h1>
        <p className="mt-1 text-[14px] text-gray">
          {ativos.length === 0
            ? "Nenhum mensalista ativo."
            : `${ativos.length} ativo${ativos.length > 1 ? "s" : ""} · ${formatarPreco(receitaSemanal)} por semana`}
        </p>
      </header>

      {podeEditar ? (
        <FormularioDeMensalista
          estabelecimentoId={estabelecimentoId}
          quadras={quadras}
          hoje={hoje}
        />
      ) : null}

      {mensalistas.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Nenhum mensalista cadastrado. O mensalista ocupa o mesmo horário toda
          semana, e cada semana vira uma reserva de verdade na agenda.
        </p>
      ) : (
        <ul className="mt-7 space-y-3">
          {[...ativos, ...encerrados].map((m) => {
            const folga = diasDeFolga(m, hoje);
            // Menos de duas semanas de ocorrências à frente é sinal de que a
            // materialização parou. O número aparece como aviso, não como
            // erro: pode ser uma série que está terminando a vigência.
            const curto = m.status === "ATIVA" && folga !== null && folga < 14;
            return (
              <li
                key={m.id}
                className={cn(
                  "rounded-card border bg-white p-5",
                  m.status === "ATIVA" ? "border-line" : "border-line/60 opacity-70",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-[17px] font-bold text-ink">
                      {m.cliente}
                    </p>
                    <p className="mt-0.5 text-[14px] text-ink">
                      {horario(m)} · {m.quadra}
                    </p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-gray">
                      desde {data(m.vigenciaInicio)}
                      {m.vigenciaFim ? ` até ${data(m.vigenciaFim)}` : " · sem fim definido"}
                      {m.status !== "ATIVA" ? ` · ${m.status.toLowerCase()}` : ""}
                    </p>
                    {m.observacao ? (
                      <p className="mt-1 text-[13px] text-gray">{m.observacao}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-[18px] font-bold text-ink">
                      {formatarPreco(m.preco)}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                      por semana
                    </p>
                  </div>
                </div>

                {m.status === "ATIVA" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line/60 pt-3">
                    <p
                      className={cn(
                        "flex-1 text-[13px]",
                        curto ? "text-coral-deep" : "text-gray",
                      )}
                    >
                      {folga === null
                        ? "Nenhuma semana gerada ainda."
                        : `Horários criados até ${data(m.materializadaAte!)}`}
                      {curto
                        ? " — isto avança sozinho todo dia, e parou. Gere agora para a agenda não abrir o horário."
                        : ""}
                    </p>
                    {podeEditar ? (
                      <>
                        <BotaoDeAcao
                          acao={() => materializarMensalista(estabelecimentoId, m.id)}
                          tom="neutro"
                          rotuloOcupado="Gerando…"
                        >
                          Gerar semanas
                        </BotaoDeAcao>
                        <BotaoDeAcao
                          acao={() => encerrarMensalista(estabelecimentoId, m.id)}
                          tom="destrutivo"
                          confirmar={`Encerrar a mensalidade de ${m.cliente}? Os horários futuros voltam para a venda; os já jogados ficam no histórico.`}
                          rotuloOcupado="Encerrando…"
                        >
                          Encerrar
                        </BotaoDeAcao>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* O que esta tela não faz, dito de frente — como a nota do gateway na
          conciliação e a de melhor esforço na trilha. */}
      <p className="mt-10 text-[13px] text-gray">
        O mensalista ocupa o horário por <strong>reservas de verdade</strong>,
        uma por semana, protegidas contra sobreposição pelo banco como qualquer
        outra. A <strong>cobrança mensal é combinada fora do sistema</strong>:
        o Rally registra quem tem o horário e quanto vale, e não emite a fatura.
        Para trocar o dia ou a hora de um mensalista, encerre e cadastre de
        novo — assim nenhuma reserva fica discordando da série que a gerou.
      </p>

      <p className="mt-3 text-[13px] text-gray">
        O horizonte de oito semanas <strong>avança sozinho todo dia</strong>.
        O botão de gerar existe para pressa — cadastrou agora e quer ver as
        semanas na agenda — e para o caso em que o aviso acima aparece, que
        é sinal de que o trabalho automático parou.
      </p>
    </div>
  );
}
