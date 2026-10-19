// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useId, useState, useTransition } from "react";

import { criarMensalista } from "@/lib/gestao/acoes";
import type { QuadraDaGestao } from "@/lib/gestao/contratos";

const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** "20/10/2026" a partir de "2026-10-20", sem passar pelo fuso. */
function data(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** O dia da semana de uma data-calendário, sem o fuso do navegador entrar. */
function diaDaSemanaDe(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

type Relatorio = {
  criadas: number;
  puladas: { data: string; motivo: string }[];
};

/**
 * Cadastro de mensalista no painel (RF-36, ADR-0014).
 *
 * **O que este formulário tem e o de cupom não é o relatório de colisão.** O
 * ADR-0014 recusou de propósito duas saídas mais simples: recusar a série
 * inteira quando uma semana não cabe, e deslocar a reserva que está no
 * caminho. A escolhida foi pular a semana **e reportar** — e relatório que não
 * chega a ninguém não é reporte. Por isso o resultado sobrevive ao fechamento
 * do formulário: quem cadastrou precisa ver quais semanas ficaram de fora para
 * falar com o cliente, e essa informação não existe em nenhum outro lugar do
 * sistema depois.
 */
export function FormularioDeMensalista({
  estabelecimentoId,
  quadras,
  hoje,
}: {
  estabelecimentoId: string;
  quadras: QuadraDaGestao[];
  /** "YYYY-MM-DD" na hora da arena: os padrões não saem do fuso do servidor. */
  hoje: string;
}) {
  // Quadra pausada está fora de serviço, e uma série semanal nela nasceria
  // combinando o que a arena não vai cumprir.
  const disponiveis = quadras.filter((q) => q.ativo);

  const [aberto, setAberto] = useState(false);
  const [quadraId, setQuadraId] = useState(disponiveis[0]?.id ?? "");
  const [clienteEmail, setClienteEmail] = useState("");
  const [diaSemana, setDiaSemana] = useState(String(diaDaSemanaDe(hoje)));
  const [horaInicio, setHoraInicio] = useState("19:00");
  const [duracao, setDuracao] = useState("60");
  const [vigenciaInicio, setVigenciaInicio] = useState(hoje);
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [preco, setPreco] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [enviando, iniciar] = useTransition();
  const id = useId();

  const quadra = disponiveis.find((q) => q.id === quadraId);
  // Dica, e não preenchimento. O preço do mensalista é **acordado**, quase
  // sempre abaixo da tabela; escrever na caixa por cima do que a pessoa
  // digitou seria o defeito do `?? padrao` que apagou um `null` deliberado no
  // serviço. A tabela aparece ao lado do campo e quem decide é o gestor.
  const sugestao = quadra
    ? (quadra.precoHora * Number(duracao || "0")) / 60
    : null;

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciar(async () => {
      const resultado = await criarMensalista(estabelecimentoId, {
        quadraId,
        clienteEmail: clienteEmail.trim(),
        diaSemana: Number(diaSemana),
        horaInicio,
        duracaoMinutos: Number(duracao),
        vigenciaInicio,
        vigenciaFim: vigenciaFim || undefined,
        preco: Number(preco),
        observacao: observacao.trim() || undefined,
      });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setRelatorio({
        criadas: resultado.criadas ?? 0,
        puladas: resultado.puladas ?? [],
      });
      setClienteEmail("");
      setPreco("");
      setObservacao("");
      setAberto(false);
    });
  }

  const rotulo =
    "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-gray";
  const campo =
    "w-full rounded-button border border-line px-3 py-2 text-[14px] text-ink " +
    "focus:border-coral";

  const resultado = relatorio ? (
    <div
      // `status` e não `alert`: é o desfecho de uma ação que deu certo, e
      // interromper a leitura da tela trataria sucesso como problema.
      role="status"
      className="mt-6 max-w-[720px] rounded-card border border-line bg-white p-5"
    >
      <p className="text-[14px] text-ink">
        <strong>Mensalista cadastrado.</strong>{" "}
        {relatorio.criadas === 1
          ? "Uma semana já está na agenda."
          : `${relatorio.criadas} semanas já estão na agenda.`}
      </p>
      {relatorio.puladas.length > 0 ? (
        <>
          <p className="mt-3 text-[14px] font-semibold text-coral-deep">
            {relatorio.puladas.length === 1
              ? "Uma semana não entrou:"
              : `${relatorio.puladas.length} semanas não entraram:`}
          </p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-ink">
            {relatorio.puladas.map((pulada) => (
              <li key={pulada.data}>
                <span className="font-mono">{data(pulada.data)}</span> —{" "}
                {pulada.motivo}
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-[62ch] text-[13px] text-gray">
            A série não foi recusada e nada foi deslocado: a reserva que já
            estava marcada continua de pé. Combine essas semanas com o cliente
            ou libere o horário na agenda e gere as semanas de novo.
          </p>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setRelatorio(null)}
        className="mt-4 min-h-[44px] rounded-button border border-line px-4 py-2
          text-[13px] font-semibold text-ink transition hover:bg-bg"
      >
        Entendi
      </button>
    </div>
  ) : null;

  if (!aberto) {
    return (
      <>
        {disponiveis.length === 0 ? (
          <p className="mt-6 text-[14px] text-gray">
            Nenhuma quadra ativa para receber mensalista. Reative uma quadra
            antes de cadastrar a série.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="mt-6 min-h-[44px] rounded-button bg-ink px-5 py-2.5
              text-[14px] font-bold text-white transition hover:brightness-110"
          >
            Cadastrar mensalista
          </button>
        )}
        {resultado}
      </>
    );
  }

  return (
    <>
      <form
        onSubmit={enviar}
        className="mt-6 grid max-w-[720px] gap-4 rounded-card border border-line
          bg-white p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-email`} className={rotulo}>
            E-mail do cliente
          </label>
          <input
            id={`${id}-email`}
            type="email"
            value={clienteEmail}
            onChange={(e) => setClienteEmail(e.target.value)}
            required
            placeholder="cliente@exemplo.com"
            className={campo}
          />
          <p className="mt-1 max-w-[62ch] text-[12px] text-gray">
            A pessoa precisa ter conta no Rally: o horário vira reserva no nome
            dela toda semana, e é isso que faz a trava do banco proteger o
            mensalista como qualquer outra reserva.
          </p>
        </div>

        <div>
          <label htmlFor={`${id}-quadra`} className={rotulo}>
            Quadra
          </label>
          <select
            id={`${id}-quadra`}
            value={quadraId}
            onChange={(e) => setQuadraId(e.target.value)}
            className={campo}
          >
            {disponiveis.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-dia`} className={rotulo}>
            Dia da semana
          </label>
          <select
            id={`${id}-dia`}
            value={diaSemana}
            onChange={(e) => setDiaSemana(e.target.value)}
            className={campo}
          >
            {DIAS.map((nome, indice) => (
              <option key={nome} value={indice}>
                {nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-hora`} className={rotulo}>
            Começa às
          </label>
          <input
            id={`${id}-hora`}
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            required
            className={campo}
          />
        </div>

        <div>
          <label htmlFor={`${id}-duracao`} className={rotulo}>
            Duração
          </label>
          <select
            id={`${id}-duracao`}
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            className={campo}
          >
            <option value="60">1 hora</option>
            <option value="90">1 hora e 30</option>
            <option value="120">2 horas</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${id}-vigencia-inicio`} className={rotulo}>
            Vale a partir de
          </label>
          <input
            id={`${id}-vigencia-inicio`}
            type="date"
            value={vigenciaInicio}
            onChange={(e) => setVigenciaInicio(e.target.value)}
            required
            className={campo}
          />
        </div>

        <div>
          <label htmlFor={`${id}-vigencia-fim`} className={rotulo}>
            Até (opcional)
          </label>
          <input
            id={`${id}-vigencia-fim`}
            type="date"
            value={vigenciaFim}
            min={vigenciaInicio}
            onChange={(e) => setVigenciaFim(e.target.value)}
            className={campo}
          />
          <p className="mt-1 text-[12px] text-gray">
            Em branco, a série segue até alguém encerrar.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${id}-preco`} className={rotulo}>
            Preço por semana (R$)
          </label>
          <input
            id={`${id}-preco`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
            required
            className={campo}
          />
          <p className="mt-1 max-w-[62ch] text-[12px] text-gray">
            {sugestao !== null
              ? `Na tabela, esse horário sai por R$ ${sugestao
                  .toFixed(2)
                  .replace(".", ",")}. `
              : ""}
            O preço é o acordado e <strong>congela em cada reserva criada</strong>{" "}
            (RN-12): reajuste vale para as semanas geradas depois, e não para as
            que já estão na agenda.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={`${id}-observacao`} className={rotulo}>
            Observação (opcional)
          </label>
          <input
            id={`${id}-observacao`}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            maxLength={280}
            placeholder="paga no dia 5, time do Augusto"
            className={campo}
          />
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={enviando}
            className="min-h-[44px] rounded-button bg-coral px-5 py-2.5
              text-[14px] font-bold text-ink transition hover:brightness-95
              disabled:opacity-60"
          >
            {enviando ? "Cadastrando…" : "Cadastrar mensalista"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              setErro(null);
            }}
            className="min-h-[44px] rounded-button border border-line px-5 py-2.5
              text-[14px] font-semibold text-ink transition hover:bg-bg"
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
      {resultado}
    </>
  );
}
