// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, PromocaoTipo } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { CuponsService } from "./cupons.service";

const AGORA = new Date("2026-10-13T13:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

function cupom(parcial: Record<string, unknown> = {}) {
  return {
    id: "c1",
    codigo: "BORAJOGAR",
    tipo: PromocaoTipo.PERCENTUAL,
    valor: new Prisma.Decimal(20),
    validadeInicio: new Date(AGORA.getTime() - 5 * DIA),
    validadeFim: new Date(AGORA.getTime() + 25 * DIA),
    usosMax: 200,
    usosFeitos: 3,
    ativo: true,
    createdAt: new Date(AGORA.getTime() - 5 * DIA),
    ...parcial,
  };
}

/**
 * Aplica `data` como o Prisma aplicaria: campo `undefined` significa "não
 * mexe", e não "apaga". Um espalhamento cru sobrescreveria a data guardada
 * com `undefined` e o mock mentiria sobre o que o banco faria.
 */
function comoOPrismaGrava(data: Record<string, unknown>) {
  const mudancas = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  return { ...cupom(), ...mudancas };
}

function servico(opcoes: { atual?: unknown; lista?: unknown[]; erroAoCriar?: unknown } = {}) {
  const criar = opcoes.erroAoCriar
    ? jest.fn().mockRejectedValue(opcoes.erroAoCriar)
    : jest.fn().mockImplementation(({ data }) => comoOPrismaGrava(data));
  const atualizar = jest.fn().mockImplementation(({ data }) => comoOPrismaGrava(data));

  const prisma = {
    promocao: {
      findMany: jest.fn().mockResolvedValue(opcoes.lista ?? [cupom()]),
      findFirst: jest.fn().mockResolvedValue(opcoes.atual === undefined ? cupom() : opcoes.atual),
      create: criar,
      update: atualizar,
    },
  } as unknown as PrismaService & Record<string, never>;

  return { servico: new CuponsService(prisma), prisma, criar, atualizar };
}

const NOVO = {
  codigo: "primeira10",
  tipo: PromocaoTipo.PERCENTUAL,
  valor: 10,
  validadeInicio: new Date(AGORA.getTime() + DIA).toISOString(),
  validadeFim: new Date(AGORA.getTime() + 30 * DIA).toISOString(),
};

describe("CuponsService (RF-25)", () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(AGORA);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  describe("listar", () => {
    it("traz o estado pronto, para a tela não repetir a regra", async () => {
      // Se a tela recalculasse "está valendo?", a lista do painel e a recusa
      // na reserva poderiam discordar sobre o mesmo cupom.
      const { servico: s } = servico();
      const [c] = await s.listar("e1");

      expect(c).toMatchObject({
        codigo: "BORAJOGAR",
        vigente: true,
        esgotado: false,
        vencido: false,
        usosFeitos: 3,
      });
    });

    it("cupom vencido e cupom esgotado se distinguem", async () => {
      const { servico: s } = servico({
        lista: [
          cupom({ id: "venc", validadeFim: new Date(AGORA.getTime() - DIA) }),
          cupom({ id: "esg", usosMax: 10, usosFeitos: 10 }),
        ],
      });
      const [vencido, esgotado] = await s.listar("e1");

      expect(vencido).toMatchObject({ vencido: true, esgotado: false, vigente: false });
      expect(esgotado).toMatchObject({ vencido: false, esgotado: true, vigente: false });
    });

    it("sem teto de usos, nunca aparece como esgotado", async () => {
      const { servico: s } = servico({
        lista: [cupom({ usosMax: null, usosFeitos: 9999 })],
      });
      const [c] = await s.listar("e1");

      expect(c.esgotado).toBe(false);
      expect(c.vigente).toBe(true);
    });

    it("lista só os cupons da arena da rota", async () => {
      const { servico: s, prisma } = servico();
      await s.listar("e1");

      expect((prisma.promocao.findMany as jest.Mock).mock.calls[0][0].where).toEqual({
        estabelecimentoId: "e1",
      });
    });
  });

  describe("criar", () => {
    it("guarda o código em maiúsculas", async () => {
      // Para a lista do painel não mostrar o mesmo cupom escrito de três
      // jeitos. A conferência na reserva já ignora a caixa.
      const { servico: s, criar } = servico();
      await s.criar("e1", NOVO);

      expect(criar.mock.calls[0][0].data.codigo).toBe("PRIMEIRA10");
    });

    it("código repetido na mesma arena é 409 com motivo", async () => {
      const { servico: s } = servico({
        erroAoCriar: new Prisma.PrismaClientKnownRequestError("unico", {
          code: "P2002",
          clientVersion: "6",
        }),
      });

      await expect(s.criar("e1", NOVO)).rejects.toThrow(ConflictException);
    });

    it("recusa validade que termina antes de começar", async () => {
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...NOVO,
          validadeInicio: NOVO.validadeFim,
          validadeFim: NOVO.validadeInicio,
        }),
      ).rejects.toThrow(/depois do começo/i);
    });

    it("recusa desconto percentual acima de 100%", async () => {
      // Um cupom de 120% devolveria dinheiro a quem reserva.
      const { servico: s } = servico();
      await expect(s.criar("e1", { ...NOVO, valor: 120 })).rejects.toThrow(/não passa de 100/i);
    });

    it("valor fixo acima de 100 é legítimo e passa", async () => {
      // R$ 120 de desconto numa quadra cara é promoção, não erro — quem
      // limita ao preço é a regra de aplicação.
      const { servico: s, criar } = servico();
      await s.criar("e1", {
        ...NOVO,
        tipo: PromocaoTipo.VALOR_FIXO,
        valor: 120,
      });

      expect(criar).toHaveBeenCalled();
    });

    it("sem teto informado, o cupom fica sem limite", async () => {
      const { servico: s, criar } = servico();
      await s.criar("e1", NOVO);

      expect(criar.mock.calls[0][0].data.usosMax).toBeNull();
    });
  });

  describe("atualizar", () => {
    it("desliga sem apagar, porque o cupom usado é origem de desconto", async () => {
      // Apagar faria sumir de onde veio o desconto de uma reserva paga, e o
      // relatório passaria a mostrar um preço que ninguém explica.
      const { servico: s, atualizar } = servico();
      await s.atualizar("e1", "c1", { ativo: false });

      expect(atualizar.mock.calls[0][0].data.ativo).toBe(false);
    });

    it("recusa teto abaixo do que já foi usado, dizendo o número", async () => {
      // A restrição do banco recusaria igual; aqui o dono recebe o número de
      // que precisa em vez de um erro de constraint.
      const { servico: s } = servico({ atual: cupom({ usosFeitos: 7 }) });

      await expect(s.atualizar("e1", "c1", { usosMax: 5 })).rejects.toThrow(/já foi usado 7/i);
    });

    it("tirar o teto é permitido mesmo com usos feitos", async () => {
      const { servico: s, atualizar } = servico({ atual: cupom({ usosFeitos: 7 }) });
      await s.atualizar("e1", "c1", { usosMax: null });

      expect(atualizar.mock.calls[0][0].data.usosMax).toBeNull();
    });

    it("cupom de outra arena é 404", async () => {
      const { servico: s, prisma } = servico({ atual: null });

      await expect(s.atualizar("e1", "c9", { ativo: false })).rejects.toThrow(NotFoundException);
      expect((prisma.promocao.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
        id: "c9",
        estabelecimentoId: "e1",
      });
    });

    it("valida a janela usando o que já estava quando só uma ponta muda", async () => {
      // Mandar só `validadeFim` para antes do início guardado tem de ser
      // recusado — senão a edição parcial cria um cupom impossível.
      const { servico: s } = servico();

      await expect(
        s.atualizar("e1", "c1", {
          validadeFim: new Date(AGORA.getTime() - 30 * DIA).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("mudar só o tipo revalida o valor que já estava guardado", async () => {
      // 120 guardado como VALOR_FIXO é legítimo; virar PERCENTUAL sem olhar
      // o valor deixaria um cupom de 120% de pé.
      const { servico: s } = servico({
        atual: cupom({ tipo: PromocaoTipo.VALOR_FIXO, valor: new Prisma.Decimal(120) }),
      });

      await expect(s.atualizar("e1", "c1", { tipo: PromocaoTipo.PERCENTUAL })).rejects.toThrow(
        /não passa de 100/i,
      );
    });

    it("mudar o valor grava Decimal, e não o número que veio do JSON", async () => {
      // **O caminho de edição que mexe em preço, e que nada exercitava.** O
      // campo é `Decimal` no banco: gravar o `number` do JSON perderia a
      // precisão que a coluna existe para guardar, e é a mesma razão de a
      // conciliação comparar em centavos.
      const { servico: s, prisma } = servico();

      const saida = await s.atualizar("e1", "c1", { valor: 12.5 });

      const { data } = (prisma.promocao.update as jest.Mock).mock.calls[0][0];
      expect(data.valor).toBeInstanceOf(Prisma.Decimal);
      expect(Number(data.valor)).toBe(12.5);
      expect(saida.valor).toBe(12.5);
    });

    it("mudar as duas pontas da validade aplica as duas", async () => {
      // O `undefined` significa "não mexe", e cada ponta tem o seu ternário:
      // é fácil escrever um e esquecer o outro, e o sintoma seria uma edição
      // que o dono faz, a tela confirma e o banco ignora pela metade.
      const { servico: s, prisma } = servico();
      const novoInicio = new Date(AGORA.getTime() + 1 * DIA);
      const novoFim = new Date(AGORA.getTime() + 40 * DIA);

      await s.atualizar("e1", "c1", {
        validadeInicio: novoInicio.toISOString(),
        validadeFim: novoFim.toISOString(),
      });

      const { data } = (prisma.promocao.update as jest.Mock).mock.calls[0][0];
      expect(data.validadeInicio).toEqual(novoInicio);
      expect(data.validadeFim).toEqual(novoFim);
    });

    it("data que não é data é 400, e não um cupom com validade `Invalid Date`", async () => {
      // `new Date("qualquer coisa")` devolve `Invalid Date` em silêncio. Sem
      // esta recusa, o cupom seria gravado com validade que nenhuma
      // comparação resolve — e um cupom cuja validade não dá para comparar
      // vale sempre ou nunca, dependendo de quem lê.
      const { servico: s, prisma } = servico();

      await expect(
        s.atualizar("e1", "c1", { validadeInicio: "primeiro de abril" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.promocao.update).not.toHaveBeenCalled();
    });
  });
});
