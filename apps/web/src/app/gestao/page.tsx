// SPDX-License-Identifier: AGPL-3.0-or-later
import { redirect } from "next/navigation";

import { Notice } from "@/components/ui/notice";
import { meusEstabelecimentos } from "@/lib/gestao/consultas";

/**
 * Entrada do painel: manda direto para a arena do usuário.
 *
 * Com um vínculo só não há o que escolher; com vários, a primeira é tão boa
 * quanto qualquer outra e a barra lateral deixa trocar. Uma tela de escolha
 * aqui seria um clique a mais em toda visita.
 */
export default async function Gestao() {
  const estabelecimentos = await meusEstabelecimentos();
  if (estabelecimentos.length > 0) redirect(`/gestao/${estabelecimentos[0].id}`);

  return (
    <div className="p-6 md:p-10">
      <Notice rotulo="Sem acesso" titulo="Você ainda não gerencia nenhuma arena">
        Peça para o administrador do estabelecimento adicionar o seu e-mail à
        equipe. Assim que ele fizer isso, o painel aparece aqui.
      </Notice>
    </div>
  );
}
