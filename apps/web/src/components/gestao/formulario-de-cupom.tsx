// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useId, useState, useTransition } from "react";

import { criarCupom } from "@/lib/gestao/acoes";

/** Hoje e daqui a 30 dias, em "YYYY-MM-DD", que é o que `input[date]` quer. */
function emDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Criação de cupom no painel (RF-25).
 *
 * Fica fechado até alguém pedir: a lista é o que o dono vem ver quase
 * sempre, e um formulário de seis campos aberto no topo empurraria os
 * cupons existentes para fora da primeira tela.
 *
 * Validade já vem preenchida com hoje–30 dias porque é a promoção que
 * alguém realmente escreve; deixar as duas datas vazias transforma o caso
 * comum em dois cliques de calendário.
 */
export function FormularioDeCupom({
  estabelecimentoId,
}: {
  estabelecimentoId: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"PERCENTUAL" | "VALOR_FIXO">("PERCENTUAL");
  const [valor, setValor] = useState("10");
  const [inicio, setInicio] = useState(emDias(0));
  const [fim, setFim] = useState(emDias(30));
  const [usosMax, setUsosMax] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const id = useId();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciar(async () => {
      const resultado = await criarCupom(estabelecimentoId, {
        codigo: codigo.trim(),
        tipo,
        valor: Number(valor.replace(",", ".")),
        // O `input[date]` dá o dia; a validade cobre o dia inteiro do fim,
        // senão um cupom "até 31/10" morreria à meia-noite do dia 30.
        validadeInicio: new Date(`${inicio}T00:00`).toISOString(),
        validadeFim: new Date(`${fim}T23:59:59`).toISOString(),
        usosMax: usosMax ? Number(usosMax) : undefined,
      });
      if (resultado.ok) {
        setCodigo("");
        setUsosMax("");
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
        className="mt-6 min-h-[44px] rounded-button bg-ink px-5 py-2.5 text-[14px] font-bold
          text-white transition hover:brightness-110"
      >
        Criar cupom
      </button>
    );
  }

  const rotulo =
    "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-gray";
  const campo =
    "w-full rounded-button border border-line px-3 py-2 text-[14px] text-ink " +
    "outline-none focus:border-coral";

  return (
    <form
      onSubmit={enviar}
      className="mt-6 grid max-w-[720px] gap-4 rounded-card border border-line
        bg-white p-5 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label htmlFor={`${id}-codigo`} className={rotulo}>
          Código
        </label>
        <input
          id={`${id}-codigo`}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          required
          minLength={3}
          maxLength={40}
          // Só letra e número: espaço e acento viram erro de digitação na hora
          // de usar, e cupom que o cliente não consegue digitar vira suporte.
          pattern="[A-Za-z0-9]+"
          placeholder="MEIODESEMANA"
          className={`${campo} font-mono tracking-[0.06em]`}
        />
      </div>

      <div>
        <label htmlFor={`${id}-tipo`} className={rotulo}>
          Tipo
        </label>
        <select
          id={`${id}-tipo`}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className={campo}
        >
          <option value="PERCENTUAL">Percentual</option>
          <option value="VALOR_FIXO">Valor fixo</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${id}-valor`} className={rotulo}>
          {tipo === "PERCENTUAL" ? "Desconto (%)" : "Desconto (R$)"}
        </label>
        <input
          id={`${id}-valor`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0.01"
          max={tipo === "PERCENTUAL" ? 100 : undefined}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
          className={campo}
        />
      </div>

      <div>
        <label htmlFor={`${id}-inicio`} className={rotulo}>
          Começa em
        </label>
        <input
          id={`${id}-inicio`}
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
          required
          className={campo}
        />
      </div>

      <div>
        <label htmlFor={`${id}-fim`} className={rotulo}>
          Vale até
        </label>
        <input
          id={`${id}-fim`}
          type="date"
          value={fim}
          onChange={(e) => setFim(e.target.value)}
          required
          className={campo}
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${id}-usos`} className={rotulo}>
          Limite de usos (opcional)
        </label>
        <input
          id={`${id}-usos`}
          type="number"
          inputMode="numeric"
          min="1"
          value={usosMax}
          onChange={(e) => setUsosMax(e.target.value)}
          placeholder="sem limite"
          className={campo}
        />
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="min-h-[44px] rounded-button bg-coral px-5 py-2.5 text-[14px] font-bold
            text-ink transition hover:brightness-95 disabled:opacity-60"
        >
          {enviando ? "Criando…" : "Criar cupom"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setErro(null);
          }}
          className="min-h-[44px] rounded-button border border-line px-5 py-2.5 text-[14px]
            font-semibold text-ink transition hover:bg-bg"
        >
          Cancelar
        </button>
      </div>

      {erro ? (
        <p role="alert" className="text-[13px] text-coral-deep sm:col-span-2">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
