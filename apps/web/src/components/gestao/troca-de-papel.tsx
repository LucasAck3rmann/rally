// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useState, useTransition } from "react";

import { trocarPapel } from "@/lib/gestao/acoes";
import type { Papel } from "@/lib/gestao/contratos";

const OPCOES: { valor: Papel; rotulo: string }[] = [
  { valor: "ATENDENTE", rotulo: "Atendente" },
  { valor: "FINANCEIRO", rotulo: "Financeiro" },
  { valor: "ADMIN", rotulo: "Administrador" },
];

/**
 * Troca o papel de alguém da equipe.
 *
 * Um `<select>` e não três botões: os papéis são **exclusivos**, e um select
 * diz isso sozinho — com botões o usuário precisa inferir que escolher um
 * desfaz o outro. A mudança vai na hora, sem botão "salvar": um campo que
 * exige confirmação separada é um passo a mais numa ação de um clique.
 */
export function TrocaDePapel({
  estabelecimentoId,
  usuarioId,
  nome,
  papel,
  ultimoAdmin,
}: {
  estabelecimentoId: string;
  usuarioId: string;
  nome: string;
  papel: Papel;
  /** Com um admin só, rebaixá-lo tranca a arena — a API recusa. */
  ultimoAdmin: boolean;
}) {
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function mudar(novo: Papel) {
    if (novo === papel) return;
    setErro(null);
    iniciar(async () => {
      const resultado = await trocarPapel(estabelecimentoId, usuarioId, novo);
      if (!resultado.ok) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor={`papel-${usuarioId}`}>
        Papel de {nome}
      </label>
      <select
        id={`papel-${usuarioId}`}
        value={papel}
        disabled={enviando}
        onChange={(evento) => mudar(evento.target.value as Papel)}
        className="rounded-button border border-line bg-white px-2.5 py-1.5 text-[13px]
          text-ink outline-none focus:border-coral disabled:opacity-60"
      >
        {OPCOES.map((opcao) => (
          <option
            key={opcao.valor}
            value={opcao.valor}
            // O último administrador não pode ser rebaixado: desabilitar a
            // opção explica antes do toque, em vez de deixar bater no 403.
            disabled={ultimoAdmin && opcao.valor !== "ADMIN"}
          >
            {opcao.rotulo}
          </option>
        ))}
        {/* `MANTENEDOR` é da plataforma e não se atribui por aqui; quando
            alguém já é, a opção aparece só para o select não mentir sobre o
            valor selecionado. */}
        {papel === "MANTENEDOR" ? (
          <option value="MANTENEDOR">Mantenedor</option>
        ) : null}
      </select>
      {erro ? (
        <span role="alert" className="text-right text-[12px] text-coral-deep">
          {erro}
        </span>
      ) : null}
    </div>
  );
}
