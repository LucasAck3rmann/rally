// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { QuadrasGestaoService } from "./quadras-gestao.service";

const MODALIDADES = [
  { id: "mod-beach", nome: "Beach Tennis" },
  { id: "mod-fute", nome: "Futevôlei" },
];

function servico(opcoes: {
  modalidades?: { id: string; nome: string }[];
  quadraExistente?: unknown;
} = {}) {
  const quadraCriada = {
    id: "q1",
    nome: "Quadra 1",
    descricao: null,
    precoHora: 80,
    capacidade: 4,
    fotos: [],
    comodidades: [],
    ativo: true,
    createdAt: new Date("2026-09-29T12:00:00.000Z"),
    modalidades: [{ nome: "Beach Tennis" }],
    faixasPreco: [],
  };

  const prisma = {
    modalidade: {
      // O dublê respeita o filtro `in`, senão "acharia" modalidades que não
      // foram pedidas e a checagem de nome desconhecido nunca dispararia.
      findMany: jest.fn().mockImplementation((args: {
        where?: { nome?: { in?: string[] } };
      }) => {
        const pedidos = args.where?.nome?.in ?? [];
        const catalogo = opcoes.modalidades ?? MODALIDADES;
        return Promise.resolve(
          catalogo.filter((m) => pedidos.includes(m.nome)),
        );
      }),
    },
    quadra: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.quadraExistente === undefined
            ? { id: "q1" }
            : opcoes.quadraExistente,
        ),
      create: jest.fn().mockResolvedValue(quadraCriada),
      update: jest.fn().mockResolvedValue(quadraCriada),
    },
    faixaPreco: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(),
  } as unknown as PrismaService & Record<string, never>;

  // `$transaction(cb)` recebe o próprio cliente — o dublê se passa por ele.
  (prisma.$transaction as unknown as jest.Mock).mockImplementation(
    (cb: (tx: unknown) => unknown) => cb(prisma),
  );

  return { servico: new QuadrasGestaoService(prisma), prisma };
}

const BASE = {
  nome: "Quadra 1",
  precoHora: 80,
  modalidades: ["Beach Tennis"],
};

describe("QuadrasGestaoService", () => {
  describe("criar", () => {
    it("liga a quadra ao estabelecimento da rota", async () => {
      const { servico: s, prisma } = servico();
      await s.criar("e1", { ...BASE });

      expect(prisma.quadra.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ estabelecimentoId: "e1" }),
        }),
      );
    });

    it("recusa modalidade que não existe em vez de inventar uma", async () => {
      const { servico: s } = servico({ modalidades: [] });
      await expect(
        s.criar("e1", { ...BASE, modalidades: ["Padel"] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("recusa faixa de preço que termina antes de começar", async () => {
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { horaInicio: "22:00", horaFim: "18:00", precoHora: 110 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("recusa faixas de preço sobrepostas no mesmo dia", async () => {
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { horaInicio: "18:00", horaFim: "22:00", precoHora: 110 },
            { horaInicio: "21:00", horaFim: "23:00", precoHora: 130 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("aceita faixas encostadas — 18:00 fecha uma e abre a outra", async () => {
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { horaInicio: "08:00", horaFim: "18:00", precoHora: 80 },
            { horaInicio: "18:00", horaFim: "23:00", precoHora: 110 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it("aceita o mesmo horário em dias diferentes", async () => {
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { diaSemana: 6, horaInicio: "10:00", horaFim: "12:00", precoHora: 95 },
            { diaSemana: 0, horaInicio: "10:00", horaFim: "12:00", precoHora: 95 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it("recusa faixa de um dia dentro de uma faixa de todos os dias", async () => {
      // Não existe "a mais específica ganha": o preço do slot é a primeira
      // faixa que casar na lista, então a sobreposição deixaria o valor
      // dependendo da ordem do array. Melhor barrar no cadastro.
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { horaInicio: "08:00", horaFim: "18:00", precoHora: 80 },
            { diaSemana: 6, horaInicio: "10:00", horaFim: "12:00", precoHora: 95 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("recusa a sobreposição quando o dia vem como null explícito", async () => {
      // `@IsOptional()` deixa passar `null` e `undefined`, e o `whitelist` não
      // remove campo que o DTO declara — então o cliente consegue mandar
      // `{"diaSemana": null}`, que no banco quer dizer "todos os dias". O caso
      // acima, com o campo omitido, já era coberto; este não era, e a faixa
      // ambígua entrava.
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { diaSemana: null, horaInicio: "08:00", horaFim: "18:00", precoHora: 80 },
            { diaSemana: 6, horaInicio: "10:00", horaFim: "12:00", precoHora: 95 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("aceita faixa com dia null que não colide com nenhuma outra", async () => {
      // Contraprova: normalizar o `null` não pode ter virado "recusa qualquer
      // coisa que tenha null".
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [
            { diaSemana: null, horaInicio: "08:00", horaFim: "10:00", precoHora: 80 },
            { diaSemana: 6, horaInicio: "10:00", horaFim: "12:00", precoHora: 95 },
          ],
        }),
      ).resolves.toBeDefined();
    });

    it("devolve o preço como número, não como Decimal do Prisma", async () => {
      const { servico: s } = servico();
      const quadra = await s.criar("e1", { ...BASE });
      expect(typeof quadra.precoHora).toBe("number");
    });
  });

  describe("atualizar", () => {
    it("não encontra quadra de outro estabelecimento", async () => {
      // O `findFirst` filtra por id **e** estabelecimentoId; de outro tenant
      // volta nulo, e o serviço responde 404.
      const { servico: s } = servico({ quadraExistente: null });
      await expect(
        s.atualizar("e1", "quadra-de-outro", { nome: "Invadida" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("procura a quadra sempre com o estabelecimento no filtro", async () => {
      const { servico: s, prisma } = servico();
      await s.atualizar("e1", "q1", { nome: "Quadra A" });

      expect(prisma.quadra.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "q1", estabelecimentoId: "e1" },
        }),
      );
    });

    it("troca as faixas por inteiro quando elas vêm no corpo", async () => {
      const { servico: s, prisma } = servico();
      await s.atualizar("e1", "q1", {
        faixasPreco: [{ horaInicio: "19:00", horaFim: "22:00", precoHora: 120 }],
      });

      expect(prisma.faixaPreco.deleteMany).toHaveBeenCalledWith({
        where: { quadraId: "q1" },
      });
    });

    it("não encosta nas faixas quando elas não vêm no corpo", async () => {
      const { servico: s, prisma } = servico();
      await s.atualizar("e1", "q1", { nome: "Só o nome" });

      expect(prisma.faixaPreco.deleteMany).not.toHaveBeenCalled();
    });

    it("pausa a quadra sem apagar nada", async () => {
      const { servico: s, prisma } = servico();
      await s.atualizar("e1", "q1", { ativo: false });

      expect(prisma.quadra.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ativo: false }),
        }),
      );
    });
  });

  describe("listar", () => {
    it("filtra pelo estabelecimento da rota", async () => {
      const { servico: s, prisma } = servico();
      await s.listar("e1");

      expect(prisma.quadra.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { estabelecimentoId: "e1" } }),
      );
    });
  });
});
