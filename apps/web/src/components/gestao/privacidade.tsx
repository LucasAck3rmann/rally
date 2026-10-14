// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useState, useTransition } from "react";

import { excluirMinhaConta } from "@/lib/conta/acoes";
import { ALVO_MINIMO } from "@/lib/estilos";
import { cn } from "@/lib/cn";

/**
 * Exportar e excluir os próprios dados, no painel (RNF-07, LGPD).
 *
 * A tela **diz o que cada direito faz antes do botão**, e não depois. Quem
 * clica em "excluir minha conta" precisa saber antes que o histórico de
 * reservas pagas continua existindo por obrigação fiscal; descobrir isso
 * depois é descobrir que a exclusão não foi o que a pessoa entendeu.
 */
export function Privacidade({ email }: { email: string }) {
  const [excluindo, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function excluir() {
    setErro(null);
    iniciar(async () => {
      const resultado = await excluirMinhaConta();
      if (!resultado.ok) {
        setErro(resultado.erro);
        setConfirmando(false);
        return;
      }
      // Recarrega na raiz: a sessão aponta para uma conta que não existe
      // mais, e qualquer tela do painel responderia 401 sem explicar.
      window.location.href = "/";
    });
  }

  return (
    <div className="mx-auto max-w-[680px] p-6 md:p-10">
      <h1 className="font-display text-[26px] font-bold text-ink">
        Privacidade e meus dados
      </h1>
      <p className="mt-2 text-[14px] text-gray">
        Direitos previstos na Lei Geral de Proteção de Dados (Lei nº 13.709/2018)
        sobre os dados da conta <strong className="text-ink">{email}</strong>.
      </p>

      <section className="mt-8 rounded-card border border-line bg-white p-6">
        <h2 className="font-display text-[18px] font-bold text-ink">
          Baixar meus dados
        </h2>
        <p className="mt-2 text-[14px] text-gray">
          Você pode baixar tudo o que guardamos sobre você, em um arquivo que{" "}
          <strong className="text-ink">outro sistema consegue ler</strong> — é o
          direito de portabilidade. Vão a conta, os vínculos com arenas, as
          reservas com o nome da quadra e do estabelecimento, os pagamentos e os
          avisos recebidos.
        </p>
        <p className="mt-2 text-[13px] text-gray">
          Sua senha não vai no arquivo: ela é guardada apenas como resumo
          criptográfico e não pode ser recuperada por ninguém, nem por nós. O
          próprio arquivo diz o que não está nele.
        </p>
        {/* Vínculo e não botão: é uma navegação para download, funciona com o
            meio clique e sem JavaScript, e o servidor é que carrega a sessão. */}
        <a
          href="/gestao/privacidade/meus-dados"
          download
          className={cn(
            "mt-5 inline-flex items-center justify-center rounded-button bg-ink",
            "px-5 text-[15px] font-semibold text-white transition hover:brightness-125",
            ALVO_MINIMO,
          )}
        >
          Baixar meus dados
        </a>
      </section>

      <section className="mt-5 rounded-card border border-line bg-white p-6">
        <h2 className="font-display text-[18px] font-bold text-ink">
          Excluir minha conta
        </h2>
        <p className="mt-2 text-[14px] text-gray">
          Seus dados pessoais são apagados e você perde o acesso. O{" "}
          <strong className="text-ink">
            histórico de reservas pagas continua guardado pela arena, por
            obrigação fiscal
          </strong>
          , sem ligação com seu nome — a própria lei ressalva a guarda para
          cumprimento de obrigação legal.
        </p>
        <p className="mt-2 text-[13px] text-gray">
          Se você for o único administrador de alguma arena, a exclusão é
          recusada até que outra pessoa seja promovida: sem administrador,
          ninguém mais conseguiria abrir o painel daquela arena.
        </p>

        {confirmando ? (
          <div
            role="alertdialog"
            aria-labelledby="titulo-confirmacao"
            className="mt-5 rounded-button border border-coral/40 bg-coral/5 p-4"
          >
            <p id="titulo-confirmacao" className="text-[14px] font-semibold text-ink">
              Isso não tem como ser desfeito. Excluir a conta {email}?
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={excluir}
                disabled={excluindo}
                className={cn(
                  "inline-flex items-center justify-center rounded-button",
                  "bg-coral px-5 text-[14px] font-bold text-ink transition",
                  "hover:brightness-95 disabled:opacity-60",
                  ALVO_MINIMO,
                )}
              >
                {excluindo ? "Excluindo…" : "Excluir definitivamente"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={excluindo}
                className={cn(
                  "inline-flex items-center justify-center rounded-button",
                  "border border-line px-5 text-[14px] font-semibold text-ink",
                  "transition hover:bg-bg disabled:opacity-60",
                  ALVO_MINIMO,
                )}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className={cn(
              "mt-5 inline-flex items-center justify-center rounded-button",
              "border border-line px-5 text-[15px] font-semibold text-coral-deep",
              "transition hover:bg-coral/5",
              ALVO_MINIMO,
            )}
          >
            Excluir minha conta
          </button>
        )}

        {erro ? (
          // `role="alert"` porque a mensagem da API é a parte útil da recusa:
          // ela diz o que fazer ("promova outra pessoa antes").
          <p role="alert" className="mt-4 text-[13px] font-semibold text-coral-deep">
            {erro}
          </p>
        ) : null}
      </section>

      <p className="mt-6 text-[12px] text-gray">
        Pedidos de exportação e eliminação são atendidos em até 15 dias, como o
        RNF-07 estabelece. Aqui os dois são imediatos, porque você mesmo executa.
      </p>
    </div>
  );
}
