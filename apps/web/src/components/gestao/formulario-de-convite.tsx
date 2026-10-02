// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useState, useTransition } from "react";

import { adicionarMembro } from "@/lib/gestao/acoes";
import type { Papel } from "@/lib/gestao/contratos";

const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: "ATENDENTE", rotulo: "Atendente" },
  { valor: "FINANCEIRO", rotulo: "Financeiro" },
  { valor: "ADMIN", rotulo: "Administrador" },
];

/** Dá acesso de equipe a quem já tem conta no Rally. */
export function FormularioDeConvite({
  estabelecimentoId,
}: {
  estabelecimentoId: string;
}) {
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  function enviar(dados: FormData) {
    const email = String(dados.get("email") ?? "").trim();
    const papel = String(dados.get("papel") ?? "ATENDENTE") as Papel;

    // Checagem só para poupar a ida à rede; quem decide é o DTO da API.
    if (!email.includes("@") || email.length < 5) {
      setErro("Informe um e-mail válido.");
      return;
    }

    setErro(null);
    setFeito(null);
    iniciar(async () => {
      const resultado = await adicionarMembro(estabelecimentoId, { email, papel });
      if (resultado.ok) setFeito(`${email} entrou na equipe.`);
      else setErro(resultado.erro);
    });
  }

  return (
    <form
      action={enviar}
      className="rounded-card border border-line bg-white p-5"
      aria-labelledby="titulo-convite"
    >
      <h2 id="titulo-convite" className="font-display text-[17px] font-bold text-ink">
        Adicionar à equipe
      </h2>
      <p className="mt-1 text-[13px] text-gray">
        {/* Declarado em vez de escondido: o MVP não tem convite pendente,
            então a pessoa precisa já ter conta. */}
        A pessoa precisa já ter conta no Rally.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
            E-mail
          </span>
          <input
            name="email"
            type="email"
            required
            placeholder="augusto@rally.com.br"
            className="w-full rounded-button border border-line px-3 py-2.5 text-[14px]
              text-ink outline-none focus:border-coral"
          />
        </label>

        <label>
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
            Papel
          </span>
          <select
            name="papel"
            defaultValue="ATENDENTE"
            className="rounded-button border border-line bg-white px-3 py-2.5 text-[14px]
              text-ink outline-none focus:border-coral"
          >
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="h-[42px] rounded-button bg-coral px-5 text-[14px] font-bold text-ink
            transition hover:brightness-95 disabled:opacity-60"
        >
          {enviando ? "Adicionando…" : "Adicionar"}
        </button>
      </div>

      {erro ? (
        <p role="alert" className="mt-3 text-[13px] text-coral-deep">
          {erro}
        </p>
      ) : null}
      {feito ? (
        // `role="status"` e não `alert`: é confirmação, não problema, e o
        // leitor anuncia sem interromper o que o usuário está fazendo.
        <p role="status" className="mt-3 text-[13px] text-ink">
          {feito}
        </p>
      ) : null}
    </form>
  );
}
