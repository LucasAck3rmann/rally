// SPDX-License-Identifier: AGPL-3.0-or-later
import { repassarArquivo } from "@/lib/gestao/repassar-arquivo";

/**
 * Baixa a exportação de dados do titular (RNF-07, LGPD).
 *
 * Rota própria pela mesma razão dos relatórios: o token está num cookie
 * `httpOnly`, de modo que um vínculo direto para a API não levaria o
 * cabeçalho de autorização, e entregá-lo ao JavaScript da página desfaria o
 * motivo de o cookie ser httpOnly. O servidor baixa e devolve.
 *
 * O nome do arquivo não leva identificador de pessoa — nem o do usuário, nem
 * o e-mail. O arquivo costuma ir para a pasta de downloads e dali para um
 * anexo, e um nome que identifique o titular vaza dado pessoal pelo próprio
 * nome, antes de alguém abrir o conteúdo.
 */
export async function GET(requisicao: Request) {
  return repassarArquivo({
    requisicao,
    caminho: "/privacidade/meus-dados",
    tipo: "application/json; charset=utf-8",
    nomePadrao: "rally-meus-dados.json",
  });
}
