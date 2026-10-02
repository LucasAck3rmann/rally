// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useState, useTransition, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { Resultado } from "@/lib/gestao/acoes";

/**
 * Botão que chama uma Server Action e mostra o que deu errado.
 *
 * Um só componente para pausar quadra, bloquear horário e trocar papel: a
 * diferença entre eles é a ação e o texto, não o comportamento. O que todos
 * precisam é o mesmo — travar durante o envio, pedir confirmação quando a
 * ação é difícil de desfazer, e **mostrar a mensagem do servidor** em vez de
 * uma genérica que não diz o que fazer.
 */
export function BotaoDeAcao({
  acao,
  children,
  confirmar,
  pedirTexto,
  tom = "neutro",
  className,
  rotuloOcupado = "Enviando…",
}: {
  /** Recebe o texto pedido por `pedirTexto`, quando houver. */
  acao: (texto?: string) => Promise<Resultado>;
  children: ReactNode;
  /** Pergunta antes de agir. Use quando desfazer custa. */
  confirmar?: string;
  /**
   * Pede um texto antes de agir (o motivo de um bloqueio, por exemplo).
   * `prompt` é cru, e é o que cabe aqui: perder o campo seria pior, e uma
   * folha só para uma linha de texto não se paga.
   */
  pedirTexto?: string;
  tom?: "neutro" | "destrutivo" | "primario";
  className?: string;
  rotuloOcupado?: string;
}) {
  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function executar() {
    if (confirmar && !window.confirm(confirmar)) return;

    let texto: string | undefined;
    if (pedirTexto) {
      const resposta = window.prompt(pedirTexto, "");
      // Cancelar aborta; texto vazio é resposta válida — "sem motivo".
      if (resposta === null) return;
      texto = resposta.trim();
    }

    setErro(null);
    iniciar(async () => {
      const resultado = await acao(texto);
      if (!resultado.ok) setErro(resultado.erro);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={executar}
        disabled={enviando}
        className={cn(
          "rounded-button px-3 py-2 text-[13px] font-semibold transition disabled:opacity-60",
          tom === "primario" && "bg-coral text-ink hover:brightness-95",
          tom === "destrutivo" && "border border-line text-coral-deep hover:bg-coral/5",
          tom === "neutro" && "border border-line text-ink hover:bg-bg",
          className,
        )}
      >
        {enviando ? rotuloOcupado : children}
      </button>
      {erro ? (
        // `role="alert"` para o leitor anunciar a recusa — a mensagem do
        // servidor costuma dizer o que fazer ("promova outra pessoa antes").
        <span role="alert" className="text-[12px] text-coral-deep">
          {erro}
        </span>
      ) : null}
    </span>
  );
}
