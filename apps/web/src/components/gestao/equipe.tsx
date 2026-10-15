// SPDX-License-Identifier: AGPL-3.0-or-later
import { BotaoDeAcao } from "@/components/gestao/botao-de-acao";
import { TrocaDePapel } from "@/components/gestao/troca-de-papel";
import { FormularioDeConvite } from "@/components/gestao/formulario-de-convite";
import { tirarDaEquipe } from "@/lib/gestao/acoes";
import type { MembroDaEquipe, Papel } from "@/lib/gestao/contratos";

const PAPEIS: Record<Papel, string> = {
  ATENDENTE: "Atendente",
  FINANCEIRO: "Financeiro",
  ADMIN: "Administrador",
  MANTENEDOR: "Mantenedor",
};

/** Primeira e última inicial, como no avatar do app. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function desdeQuando(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(d);
}

export function EquipeDaArena({
  equipe,
  estabelecimentoId,
  podeEditar,
}: {
  equipe: MembroDaEquipe[];
  estabelecimentoId: string;
  /// Só admin mexe na equipe; ver é de toda a equipe.
  podeEditar: boolean;
}) {
  const admins = equipe.filter((m) => m.papel === "ADMIN").length;

  return (
    <div className="p-6 md:p-10">
      <header>
        <h1 className="font-display text-[28px] font-bold text-ink md:text-[32px]">
          Equipe
        </h1>
        <p className="mt-1 text-[14px] text-gray">
          Quem tem acesso a esta arena
        </p>
      </header>

      {equipe.length === 0 ? (
        <p className="mt-8 rounded-card border border-line bg-white p-8 text-center text-[15px] text-gray">
          Só você por aqui. Adicione quem atende no balcão ou cuida do
          financeiro pelo aplicativo.
        </p>
      ) : (
        <ul className="mt-7 space-y-2.5">
          {equipe.map((membro) => (
            <li
              key={membro.usuarioId}
              className="flex items-center gap-4 rounded-card border border-line bg-white px-5 py-4"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full
                  bg-sand font-display text-[15px] font-bold text-ink"
              >
                {iniciais(membro.nome)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[16px] font-bold text-ink">
                  {membro.nome}
                </p>
                <p className="truncate text-[13px] text-gray">{membro.email}</p>
              </div>
              <div className="shrink-0 text-right">
                {podeEditar ? (
                  <TrocaDePapel
                    estabelecimentoId={estabelecimentoId}
                    usuarioId={membro.usuarioId}
                    nome={membro.nome}
                    papel={membro.papel}
                    ultimoAdmin={admins === 1 && membro.papel === "ADMIN"}
                  />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray">
                    {PAPEIS[membro.papel]}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-gray">
                  desde {desdeQuando(membro.desde)}
                </p>
              </div>
              {podeEditar ? (
                <BotaoDeAcao
                  acao={() => tirarDaEquipe(estabelecimentoId, membro.usuarioId)}
                  tom="destrutivo"
                  // Dizer o que acontece de verdade: o vínculo vira cliente e
                  // as reservas ficam. "Remover" sozinho soa como apagar.
                  confirmar={`Tirar ${membro.nome} da equipe? Ela perde o acesso à gestão, mas continua cliente da arena e as reservas dela ficam.`}
                  className="shrink-0"
                >
                  Tirar
                </BotaoDeAcao>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* Com um administrador só, dizer isso aqui previne o engano antes de
          ele acontecer: rebaixar o único admin tranca a arena, e a tela que
          consertaria exige ser admin. */}
      {admins === 1 ? (
        <p className="mt-6 rounded-card border border-coral/30 bg-coral/5 px-5 py-4 text-[13px] text-coral-deep">
          Há um único administrador nesta arena. Promova outra pessoa antes de
          mudar o papel dele — sem administrador, ninguém consegue abrir esta
          tela para desfazer.
        </p>
      ) : null}

      {podeEditar ? (
        <div className="mt-8">
          <FormularioDeConvite estabelecimentoId={estabelecimentoId} />
        </div>
      ) : null}
    </div>
  );
}
