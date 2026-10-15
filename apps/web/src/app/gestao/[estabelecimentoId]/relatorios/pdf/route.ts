// SPDX-License-Identifier: AGPL-3.0-or-later
import { repassarArquivo } from "@/lib/gestao/repassar-arquivo";

/** Repassa o relatório em PDF (RF-28). */
export async function GET(
  requisicao: Request,
  contexto: { params: Promise<{ estabelecimentoId: string }> },
) {
  const { estabelecimentoId } = await contexto.params;
  return repassarArquivo({
    requisicao,
    caminho: `/gestao/estabelecimentos/${estabelecimentoId}/relatorios/pdf`,
    tipo: "application/pdf",
    nomePadrao: "rally-relatorio.pdf",
  });
}
