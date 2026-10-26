// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repassarArquivo } from "./repassar-arquivo";

const lerToken = vi.fn();
vi.mock("../auth/sessao", () => ({ lerToken: () => lerToken() }));

/**
 * **O repasse de arquivo da API para o navegador.**
 *
 * Uma função, **doze ramos, nenhum percorrido** — e é por onde saem os três
 * relatórios (RF-28) e a exportação de dados do titular (RNF-07, LGPD). Ela
 * existe por uma razão de segurança: o token está num cookie `httpOnly`, de
 * modo que um vínculo direto para a API não levaria `Authorization`, e dar o
 * token ao JavaScript da página para montar o download desfaria o motivo de
 * o cookie ser httpOnly.
 *
 * O que estes testes fixam não é o download, são as três decisões que ele
 * carrega:
 *
 * 1. **Sem token, nada sai.** A função manda para o login em vez de chamar a
 *    API sem credencial — que devolveria 401 e apareceria como arquivo de
 *    texto com erro em inglês.
 * 2. **Só `de` e `ate` atravessam.** A consulta do pedido do navegador não é
 *    repassada inteira: a função copia dois parâmetros nomeados. É lista de
 *    permissão, e é o que impede alguém de anexar parâmetro à chamada
 *    autenticada da API passando pela URL da tela.
 * 3. **Falha vira texto, não JSON.** Quem clicou esperava um arquivo; um
 *    objeto de erro não diz nada a quem não é programador.
 *
 * A quarta é sobre o conteúdo: `arrayBuffer` e não `text`, porque XLSX e PDF
 * são binários e ler como texto os corrompe. Um teste com bytes que não são
 * texto válido é o que separa uma coisa da outra.
 */

const PEDIDO = {
  caminho: "/gestao/estabelecimentos/e1/relatorios/xlsx",
  tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  nomePadrao: "rally-relatorio.xlsx",
};

function daApi(
  corpo: ArrayBuffer | Uint8Array,
  { status = 200, disposicao }: { status?: number; disposicao?: string } = {},
) {
  const cabecalhos = new Headers();
  if (disposicao) cabecalhos.set("content-disposition", disposicao);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: cabecalhos,
    arrayBuffer: () => Promise.resolve(corpo instanceof Uint8Array ? corpo.buffer : corpo),
  } as unknown as Response;
}

describe("repassarArquivo", () => {
  beforeEach(() => {
    lerToken.mockReset().mockResolvedValue("token-bom");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sem sessão, manda para o login e não chama a API", async () => {
    lerToken.mockResolvedValue(null);

    const resposta = await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toContain("/entrar");
    // Não chamar é a parte que importa: a API responderia 401, e 401 chega ao
    // usuário como arquivo de texto com erro em inglês.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("leva a sessão no cabeçalho e não cacheia o arquivo", async () => {
    vi.mocked(fetch).mockResolvedValue(daApi(new Uint8Array([1, 2, 3])));

    await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    const [, opcoes] = vi.mocked(fetch).mock.calls[0];
    expect(opcoes?.headers).toMatchObject({ Authorization: "Bearer token-bom" });
    expect(opcoes?.cache).toBe("no-store");
  });

  it("repassa `de` e `ate`, e deixa de fora o resto da consulta", async () => {
    // Lista de permissão, e não cópia da consulta: sem isso, qualquer
    // parâmetro posto na URL da tela chegaria à chamada autenticada da API.
    vi.mocked(fetch).mockResolvedValue(daApi(new Uint8Array([1])));

    await repassarArquivo({
      requisicao: new Request(
        "http://localhost:3000/gestao/e1/relatorios/xlsx?de=2026-10-01&ate=2026-10-31&limite=9999&estabelecimentoId=outro",
      ),
      ...PEDIDO,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    const alvo = new URL(String(url));
    expect(alvo.searchParams.get("de")).toBe("2026-10-01");
    expect(alvo.searchParams.get("ate")).toBe("2026-10-31");
    expect(alvo.searchParams.get("limite")).toBeNull();
    expect(alvo.searchParams.get("estabelecimentoId")).toBeNull();
    expect(alvo.pathname).toContain(PEDIDO.caminho);
  });

  it("não inventa parâmetro vazio quando o pedido não traz período", async () => {
    vi.mocked(fetch).mockResolvedValue(daApi(new Uint8Array([1])));

    await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    const alvo = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(alvo.search).toBe("");
  });

  it("devolve os bytes intactos, que é o que separa XLSX de texto", async () => {
    // `0xff 0xfe 0x00` não é UTF-8 válido: se o repasse lesse a resposta como
    // texto, estes bytes voltariam substituídos pelo caractere de erro.
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xfe, 0x00]);
    vi.mocked(fetch).mockResolvedValue(daApi(bytes));

    const resposta = await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    expect(resposta.headers.get("content-type")).toBe(PEDIDO.tipo);
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(bytes);
  });

  it("usa o nome que a API mandou, quando ela mandou um", async () => {
    vi.mocked(fetch).mockResolvedValue(
      daApi(new Uint8Array([1]), {
        disposicao: 'attachment; filename="relatorio-outubro.xlsx"',
      }),
    );

    const resposta = await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    expect(resposta.headers.get("content-disposition")).toContain("relatorio-outubro.xlsx");
  });

  it("cai no nome padrão quando a API não diz como chamar o arquivo", async () => {
    vi.mocked(fetch).mockResolvedValue(daApi(new Uint8Array([1])));

    const resposta = await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    expect(resposta.headers.get("content-disposition")).toBe(
      'attachment; filename="rally-relatorio.xlsx"',
    );
  });

  it("erro da API vira texto em português, e preserva o código", async () => {
    vi.mocked(fetch).mockResolvedValue(daApi(new Uint8Array([]), { status: 403 }));

    const resposta = await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    expect(resposta.status).toBe(403);
    expect(resposta.headers.get("content-type")).toContain("text/plain");
    await expect(resposta.text()).resolves.toContain("Não foi possível gerar");
  });

  it("API fora do ar é 502, e não exceção na rota", async () => {
    // O `.catch(() => null)` do repasse existe para isto: uma rota do App
    // Router que lança devolve a página de erro do Next, em vez de uma frase
    // que diz para tentar de novo.
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const resposta = await repassarArquivo({
      requisicao: new Request("http://localhost:3000/gestao/e1/relatorios/xlsx"),
      ...PEDIDO,
    });

    expect(resposta.status).toBe(502);
    await expect(resposta.text()).resolves.toContain("Tente de novo");
  });
});
