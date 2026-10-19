// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useId, useState, useTransition } from "react";
import { ALVO_MINIMO } from "@/lib/estilos";

import { intervaloLocal } from "@/lib/formato";
import { moverReserva } from "@/lib/gestao/acoes";

/**
 * Move uma reserva para outra hora e, se preciso, para outra quadra (RF-21).
 *
 * Tem formulário próprio e não o `BotaoDeAcao` por um motivo concreto:
 * aquele pede **um** texto por `window.prompt`, e mover precisa de dois
 * campos ligados — quadra e hora. Dois prompts seguidos perderiam o
 * primeiro se o dono cancelasse o segundo, e nenhum dos dois mostraria as
 * opções válidas.
 *
 * A duração é preservada: quem move às 19h uma reserva de duas horas quer
 * a mesma reserva às 21h, não uma de uma hora. Mudar a duração é outro ato.
 */
export function MoverReserva({
  estabelecimentoId,
  reservaId,
  data,
  quadraAtual,
  horaAtual,
  duracaoEmHoras,
  quadras,
  horas,
}: {
  estabelecimentoId: string;
  reservaId: string;
  /** "2026-10-08" — o dia que a grade está mostrando. */
  data: string;
  quadraAtual: string;
  horaAtual: number;
  duracaoEmHoras: number;
  quadras: { id: string; nome: string }[];
  horas: number[];
}) {
  const [aberto, setAberto] = useState(false);
  const [quadraId, setQuadraId] = useState(quadraAtual);
  const [hora, setHora] = useState(horaAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const id = useId();

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await moverReserva(estabelecimentoId, reservaId, {
        quadraId,
        ...intervaloLocal(data, hora, duracaoEmHoras),
      });
      if (resultado.ok) {
        setAberto(false);
        return;
      }
      setErro(resultado.erro);
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        // Media **40,8 × 16,5 px** no navegador, contra o piso de 44 do
        // RNF-08. Escapava dos portões porque a agenda não estava na lista
        // de cenários, e a âncora deles media tamanho da varredura em vez
        // de correspondência com as telas.
        //
        // `inline-flex` com `justify-center` é o que faz o alvo crescer sem
        // empurrar o texto: a altura vem do `min-h`, não do conteúdo, e o
        // rótulo segue em 11 px no meio dele.
        className={`mt-0.5 inline-flex ${ALVO_MINIMO} min-w-[44px] items-center
          justify-center rounded-button px-3 text-[11px] text-gray transition
          hover:bg-bg hover:text-ink`}
      >
        Mover
      </button>
    );
  }

  return (
    // `absolute` sobre a célula: a grade é apertada, e um formulário que
    // empurrasse a linha reorganizaria o dia inteiro a cada abertura.
    <div
      className="absolute left-0 top-full z-10 mt-1 w-[200px] rounded-card border
        border-line bg-white p-2.5 shadow-lg"
    >
      <label
        htmlFor={`${id}-quadra`}
        className="block font-mono text-[9px] uppercase tracking-[0.15em] text-gray"
      >
        Quadra
      </label>
      <select
        id={`${id}-quadra`}
        value={quadraId}
        onChange={(e) => setQuadraId(e.target.value)}
        className="mt-1 w-full rounded-button border border-line px-2 py-1.5
          text-[12px] text-ink focus:border-coral"
      >
        {quadras.map((q) => (
          <option key={q.id} value={q.id}>
            {q.nome}
          </option>
        ))}
      </select>

      <label
        htmlFor={`${id}-hora`}
        className="mt-2 block font-mono text-[9px] uppercase tracking-[0.15em] text-gray"
      >
        Hora
      </label>
      <select
        id={`${id}-hora`}
        value={hora}
        onChange={(e) => setHora(Number(e.target.value))}
        className="mt-1 w-full rounded-button border border-line px-2 py-1.5
          text-[12px] text-ink focus:border-coral"
      >
        {horas.map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>

      <div className="mt-2.5 flex gap-1.5">
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="rounded-button bg-coral px-3 py-1.5 text-[12px] font-bold
            text-ink transition hover:brightness-95 disabled:opacity-60"
        >
          {enviando ? "Movendo…" : "Mover"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
          className="rounded-button border border-line px-3 py-1.5 text-[12px]
            font-semibold text-ink transition hover:bg-bg"
        >
          Cancelar
        </button>
      </div>

      {erro ? (
        // A recusa do servidor costuma dizer o que fazer ("esse horário já
        // tem reserva"), e é ela que o leitor de tela precisa anunciar.
        <p role="alert" className="mt-2 text-[11px] text-coral-deep">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
