// SPDX-License-Identifier: AGPL-3.0-or-later
import { Logger } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { AuditoriaService } from "./auditoria.service";

/**
 * A leitura e a escrita da trilha (RN-05).
 *
 * O serviço não tinha arquivo de teste. As duas coisas que ele garante não
 * aparecem no retorno: o **teto** da leitura, porque a trilha é a única
 * tabela do projeto sem expurgo e cresce para sempre; e o fato de a escrita
 * **nunca derrubar a ação auditada** — registrar é consequência, e falhar ao
 * registrar não pode desfazer o que a pessoa acabou de fazer.
 */
describe("AuditoriaService", () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const create = jest.fn();
  const prisma = { auditLog: { findMany, create } } as unknown as PrismaService;
  const service = new AuditoriaService(prisma);

  beforeEach(() => jest.clearAllMocks());

  /** O `take` que chegou à consulta. */
  function teto() {
    return findMany.mock.calls[0][0].take;
  }

  describe("listar — o teto da trilha", () => {
    it("sem pedido, traz cem", async () => {
      await service.listar("e1");
      expect(teto()).toBe(100);
    });

    it("pedido maior que o teto é cortado em quinhentos", async () => {
      await service.listar("e1", 10_000);
      expect(teto()).toBe(500);
    });

    it("pedido de zero ou negativo vira um, e não uma consulta sem linha", async () => {
      await service.listar("e1", 0);
      expect(teto()).toBe(1);
    });

    /**
     * **O achado deste teste.** O controlador converte o parâmetro da URL com
     * `Number(...)`, e `Number("abc")` é `NaN`. O teto era
     * `Math.min(Math.max(limite, 1), 500)`, e `NaN` atravessa os dois: o
     * `take` chegava ao Prisma como `NaN`, de modo que `?limite=abc`
     * respondia erro de servidor em vez de cair no padrão. O teto protegia
     * contra número grande, não contra não-número.
     */
    it("limite que não é número cai no padrão, e não vira NaN", async () => {
      await service.listar("e1", Number("abc"));
      expect(teto()).toBe(100);
    });

    it("lê só o estabelecimento pedido, do mais recente para o mais antigo", async () => {
      await service.listar("e1");

      const { where, orderBy } = findMany.mock.calls[0][0];
      expect(where).toEqual({ estabelecimentoId: "e1" });
      expect(orderBy).toEqual({ criadoEm: "desc" });
    });
  });

  describe("registrar — falhar não derruba a ação auditada", () => {
    const registro = {
      estabelecimentoId: "e1",
      autorId: "u1",
      acao: "reserva.cancelar",
      entidade: "Reserva",
      entidadeId: "r1",
    };

    it("grava a linha da trilha", async () => {
      create.mockResolvedValueOnce({});
      await service.registrar(registro);
      expect(create.mock.calls[0][0].data.acao).toBe("reserva.cancelar");
    });

    it("falha ao gravar não propaga: a ação já aconteceu", async () => {
      // Se propagasse, um defeito na trilha desfaria o cancelamento que o
      // cliente acabou de confirmar — a consequência engolindo a causa.
      const erro = jest.spyOn(Logger.prototype, "error").mockImplementation();
      create.mockRejectedValueOnce(new Error("tabela fora do ar"));

      await expect(service.registrar(registro)).resolves.toBeUndefined();
      expect(erro).toHaveBeenCalled();
      erro.mockRestore();
    });

    it("o registro sem entidade não deixa buraco na mensagem de falha", async () => {
      const erro = jest.spyOn(Logger.prototype, "error").mockImplementation();
      create.mockRejectedValueOnce(new Error("tabela fora do ar"));

      await service.registrar({ ...registro, entidadeId: null });

      const mensagem = String(erro.mock.calls[0][0]);
      expect(mensagem).toContain("reserva.cancelar em Reserva");
      expect(mensagem).not.toContain("null");
      erro.mockRestore();
    });

    it("o que é lançado sem ser Error não vira pilha inventada", async () => {
      const erro = jest.spyOn(Logger.prototype, "error").mockImplementation();
      create.mockRejectedValueOnce("string solta");

      await service.registrar(registro);

      // Segundo argumento é a pilha; sem `Error` não há pilha, e o lugar
      // fica vazio em vez de receber o valor cru.
      expect(erro.mock.calls[0][1]).toBeUndefined();
      erro.mockRestore();
    });
  });
});
