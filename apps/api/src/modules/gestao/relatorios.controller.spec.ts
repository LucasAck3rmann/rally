// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Response } from "express";

import { RelatoriosController } from "./relatorios.controller";
import { RelatoriosService } from "./relatorios.service";

/**
 * **A fiação das três exportações (RF-28).**
 *
 * Era o controlador menos coberto do projeto: 50% de instruções e 20% de
 * funções, com os três manipuladores de exportação inteiros sem nenhuma
 * execução. O serviço que **monta** cada arquivo tinha suíte desde setembro;
 * o que **entrega** o arquivo, não.
 *
 * A diferença não é acadêmica. Tudo o que decide se o download funciona mora
 * aqui e não no serviço: o tipo de conteúdo, o nome do arquivo e o
 * `attachment`. Um `Content-Type` errado faz o navegador exibir o XLSX como
 * texto; um `Content-Disposition` ausente faz o PDF abrir na aba em vez de
 * baixar; e um nome vindo do serviço e ignorado aqui entregaria todo
 * relatório chamado `download`. Nenhuma dessas três falhas apareceria num
 * teste do serviço.
 */

function servico() {
  return {
    relatorio: jest.fn().mockResolvedValue({ resumo: {} }),
    csv: jest.fn().mockResolvedValue({
      arquivo: "rally-relatorio-2026-09-10-a-2026-09-12.csv",
      conteudo: "﻿cabecalho;valor\n",
    }),
    xlsx: jest.fn().mockResolvedValue({
      arquivo: "rally-relatorio-2026-09-10-a-2026-09-12.xlsx",
      conteudo: Buffer.from("PK\u0003\u0004conteudo-binario"),
    }),
    pdf: jest.fn().mockResolvedValue({
      arquivo: "rally-relatorio-2026-09-10-a-2026-09-12.pdf",
      conteudo: Buffer.from("%PDF-1.3"),
    }),
  };
}

function resposta() {
  const cabecalhos: Record<string, string> = {};
  const enviado: { corpo?: unknown } = {};
  const res = {
    setHeader: (nome: string, valor: string) => {
      cabecalhos[nome] = valor;
    },
    send: (corpo: unknown) => {
      enviado.corpo = corpo;
    },
  } as unknown as Response;
  return { res, cabecalhos, enviado };
}

const E = "e1";
const DE = "2026-09-10";
const ATE = "2026-09-12";

describe("RelatoriosController (RF-27, RF-28)", () => {
  it("o relatório em JSON repassa estabelecimento e período", async () => {
    const s = servico();
    const controlador = new RelatoriosController(s as unknown as RelatoriosService);

    await controlador.relatorio(E, DE, ATE);

    expect(s.relatorio).toHaveBeenCalledWith(E, DE, ATE);
  });

  describe.each([
    {
      formato: "csv" as const,
      tipo: "text/csv; charset=utf-8",
      extensao: ".csv",
    },
    {
      formato: "xlsx" as const,
      tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extensao: ".xlsx",
    },
    {
      formato: "pdf" as const,
      tipo: "application/pdf",
      extensao: ".pdf",
    },
  ])("exportação em $formato", ({ formato, tipo, extensao }) => {
    it("declara o tipo de conteúdo certo", async () => {
      const s = servico();
      const { res, cabecalhos } = resposta();
      const controlador = new RelatoriosController(s as unknown as RelatoriosService);

      await controlador[formato](E, DE, ATE, res);

      expect(cabecalhos["Content-Type"]).toBe(tipo);
    });

    it("baixa como anexo, com o nome que o serviço escolheu", async () => {
      // O nome carrega o período — `attachment` sem o nome do serviço
      // entregaria todo relatório com o nome da rota, e dois downloads
      // seguidos viriam indistinguíveis na pasta.
      const s = servico();
      const { res, cabecalhos } = resposta();
      const controlador = new RelatoriosController(s as unknown as RelatoriosService);

      await controlador[formato](E, DE, ATE, res);

      expect(cabecalhos["Content-Disposition"]).toBe(
        `attachment; filename="rally-relatorio-2026-09-10-a-2026-09-12${extensao}"`,
      );
    });

    it("envia o conteúdo que o serviço montou, sem reescrevê-lo", async () => {
      const s = servico();
      const { res, enviado } = resposta();
      const controlador = new RelatoriosController(s as unknown as RelatoriosService);

      await controlador[formato](E, DE, ATE, res);

      const { conteudo } = await s[formato].mock.results[0].value;
      expect(enviado.corpo).toEqual(conteudo);
    });

    it("repassa estabelecimento e período ao serviço", async () => {
      const s = servico();
      const { res } = resposta();
      const controlador = new RelatoriosController(s as unknown as RelatoriosService);

      await controlador[formato](E, DE, ATE, res);

      expect(s[formato]).toHaveBeenCalledWith(E, DE, ATE);
    });
  });

  it("o CSV sai com o BOM que o Excel brasileiro precisa", async () => {
    // O cabeçalho diz utf-8 ao navegador, mas o Excel ignora o cabeçalho ao
    // abrir arquivo local — é o BOM que faz "Futevôlei" chegar inteiro. Os
    // dois precisam coexistir, e este teste prende essa dupla.
    const s = servico();
    const { res, cabecalhos, enviado } = resposta();
    const controlador = new RelatoriosController(s as unknown as RelatoriosService);

    await controlador.csv(E, DE, ATE, res);

    expect(cabecalhos["Content-Type"]).toContain("charset=utf-8");
    expect(String(enviado.corpo).startsWith("﻿")).toBe(true);
  });

  it("o XLSX e o PDF vão como Buffer, e não como texto", async () => {
    // Ler binário como texto corrompe o arquivo, e o sintoma é "o Excel diz
    // que o arquivo está danificado" — longe da causa.
    const s = servico();
    const controlador = new RelatoriosController(s as unknown as RelatoriosService);

    const x = resposta();
    await controlador.xlsx(E, DE, ATE, x.res);
    const p = resposta();
    await controlador.pdf(E, DE, ATE, p.res);

    expect(Buffer.isBuffer(x.enviado.corpo)).toBe(true);
    expect(Buffer.isBuffer(p.enviado.corpo)).toBe(true);
  });

  it("falha do serviço sobe, em vez de virar arquivo vazio", async () => {
    // Engolir o erro aqui entregaria um arquivo de zero byte com status 200,
    // e quem baixou abriria um relatório em branco sem saber que falhou.
    const s = servico();
    s.pdf.mockRejectedValue(new Error("período inválido"));
    const { res, enviado } = resposta();
    const controlador = new RelatoriosController(s as unknown as RelatoriosService);

    await expect(controlador.pdf(E, DE, ATE, res)).rejects.toThrow("período inválido");
    expect(enviado.corpo).toBeUndefined();
  });
});
