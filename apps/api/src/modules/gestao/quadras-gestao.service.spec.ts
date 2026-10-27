// SPDX-License-Identifier: AGPL-3.0-or-later
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { QuadrasGestaoService } from "./quadras-gestao.service";

const MODALIDADES = [
  { id: "mod-beach", nome: "Beach Tennis" },
  { id: "mod-fute", nome: "Futevôlei" },
];

function servico(
  opcoes: {
    modalidades?: { id: string; nome: string }[];
    quadraExistente?: unknown;
  } = {},
) {
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
      findMany: jest.fn().mockImplementation((args: { where?: { nome?: { in?: string[] } } }) => {
        const pedidos = args.where?.nome?.in ?? [];
        const catalogo = opcoes.modalidades ?? MODALIDADES;
        return Promise.resolve(catalogo.filter((m) => pedidos.includes(m.nome)));
      }),
    },
    quadra: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opcoes.quadraExistente === undefined ? { id: "q1" } : opcoes.quadraExistente,
        ),
      create: jest.fn().mockResolvedValue(quadraCriada),
      update: jest.fn().mockResolvedValue(quadraCriada),
    },
    faixaPreco: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(),
  } as unknown as PrismaService & Record<string, never>;

  // `$transaction(cb)` recebe o próprio cliente — o dublê se passa por ele.
  (prisma.$transaction as unknown as jest.Mock).mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(prisma),
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
      await expect(s.criar("e1", { ...BASE, modalidades: ["Padel"] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("recusa faixa de preço que termina antes de começar", async () => {
      const { servico: s } = servico();
      await expect(
        s.criar("e1", {
          ...BASE,
          faixasPreco: [{ horaInicio: "22:00", horaFim: "18:00", precoHora: 110 }],
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

    it("mudar o preço grava Decimal, e não o número do JSON", async () => {
      // O campo é `Decimal` no banco. Gravar o `number` do JSON perderia a
      // precisão que a coluna existe para guardar — e este é o número que a
      // vitrine multiplica pela duração para dizer quanto o jogador paga.
      const { servico: s, prisma } = servico();

      await s.atualizar("e1", "q1", { precoHora: 92.5 });

      const { data } = (prisma.quadra.update as jest.Mock).mock.calls[0][0];
      expect(data.precoHora).toBeInstanceOf(Prisma.Decimal);
      expect(Number(data.precoHora)).toBe(92.5);
    });

    it("mudar as modalidades resolve os nomes e troca o conjunto inteiro", async () => {
      // `set` e não `connect`: a edição **substitui** a lista, porque tirar
      // uma modalidade é tão legítimo quanto acrescentar. Com `connect`, a
      // modalidade removida ficaria, e a tela diria uma coisa e o filtro da
      // vitrine outra.
      const { servico: s, prisma } = servico();

      // Os dois nomes existem no catálogo do dublê. Nome fora dele é
      // recusado, e isso já tem teste no `criar` — aqui o assunto é o
      // `set`, e não a validação do nome.
      await s.atualizar("e1", "q1", { modalidades: ["Futevôlei", "Beach Tennis"] });

      const { data } = (prisma.quadra.update as jest.Mock).mock.calls[0][0];
      expect(data.modalidades).toHaveProperty("set");
      expect(data.modalidades.set).toHaveLength(2);
      // Identificadores, e não os nomes: é o que o `resolverModalidades`
      // existe para traduzir, e é ele que recusa nome desconhecido.
      for (const m of data.modalidades.set) {
        expect(m).toHaveProperty("id");
        expect(typeof m.id).toBe("string");
      }
    });

    it("sem modalidades no corpo, o conjunto não é tocado", async () => {
      // O par do teste acima: `undefined` significa "não mexe". Mandar `set`
      // com lista vazia apagaria todas as modalidades de uma quadra em que
      // alguém só quis trocar o nome.
      const { servico: s, prisma } = servico();

      await s.atualizar("e1", "q1", { nome: "Quadra Coberta" });

      const { data } = (prisma.quadra.update as jest.Mock).mock.calls[0][0];
      expect(data.modalidades).toBeUndefined();
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

  describe("o DTO da quadra", () => {
    it("a mensagem de modalidade desconhecida nomeia só a que falta", async () => {
      // **O caso que faltava:** o teste existente manda um nome inválido
      // sozinho, de modo que nada é achado e a lista de "faltando" sai da
      // diferença contra o vazio. Com um nome válido e um inválido juntos, a
      // mensagem tem de citar **apenas** o inválido — citar os dois faria o
      // dono procurar erro na modalidade que está certa.
      const { servico: s } = servico();

      await expect(
        s.criar("e1", {
          nome: "Quadra 2",
          precoHora: 80,
          modalidades: ["Beach Tennis", "Peteca"],
        } as never),
      ).rejects.toThrow(/Peteca/);
      await expect(
        s.criar("e1", {
          nome: "Quadra 2",
          precoHora: 80,
          modalidades: ["Beach Tennis", "Peteca"],
        } as never),
      ).rejects.not.toThrow(/Beach Tennis/);
    });

    it("as faixas de preço saem com número, e não com Decimal", async () => {
      // As fixtures do arquivo trazem `faixasPreco: []`, de modo que este
      // trecho do DTO nunca rodava. A faixa é o que decide o preço do
      // horário na vitrine: `Decimal` do Prisma não atravessa JSON de um
      // jeito que a tela saiba ler, e o `id` vai junto porque a tela precisa
      // dele para editar a faixa sem recriar as outras.
      const { servico: s } = servico({
        quadraExistente: {
          id: "q1",
          nome: "Quadra 1",
          descricao: null,
          precoHora: new Prisma.Decimal(80),
          capacidade: 4,
          fotos: [],
          comodidades: [],
          ativo: true,
          createdAt: new Date("2026-09-29T12:00:00.000Z"),
          modalidades: [{ nome: "Beach Tennis" }, { nome: "Futevôlei" }],
          faixasPreco: [
            {
              id: "f1",
              diaSemana: 2,
              horaInicio: "19:00",
              horaFim: "22:00",
              precoHora: new Prisma.Decimal(120),
            },
            {
              id: "f2",
              diaSemana: null,
              horaInicio: "08:00",
              horaFim: "12:00",
              precoHora: new Prisma.Decimal(60),
            },
          ],
        },
      });

      const saida = await s.detalhe("e1", "q1");

      expect(saida.modalidades).toEqual(["Beach Tennis", "Futevôlei"]);
      expect(saida.faixasPreco).toHaveLength(2);
      expect(saida.faixasPreco[0]).toEqual({
        id: "f1",
        diaSemana: 2,
        horaInicio: "19:00",
        horaFim: "22:00",
        precoHora: 120,
      });
      // `null` no dia significa "todos os dias", e tem de sobreviver ao DTO:
      // virar `undefined` faria a tela mostrar a faixa sem dia nenhum.
      expect(saida.faixasPreco[1].diaSemana).toBeNull();
    });
  });

  describe("detalhe", () => {
    it("procura a quadra dentro do estabelecimento da rota", async () => {
      // **Não tinha teste nenhum, e é a leitura que alimenta o formulário de
      // edição.** O escopo aqui é o mesmo do resto da gestão: sem o
      // `estabelecimentoId` no filtro, um admin leria a quadra de outra
      // arena pelo id — com preço, fotos e faixas.
      const { servico: s, prisma } = servico({
        quadraExistente: {
          id: "q1",
          nome: "Quadra 1",
          descricao: null,
          precoHora: new Prisma.Decimal(80),
          capacidade: 4,
          fotos: [],
          comodidades: [],
          ativo: true,
          createdAt: new Date("2026-09-29T12:00:00.000Z"),
          modalidades: [{ nome: "Beach Tennis" }],
          faixasPreco: [],
        },
      });

      const saida = await s.detalhe("e1", "q1");

      expect(prisma.quadra.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "q1", estabelecimentoId: "e1" } }),
      );
      expect(saida.nome).toBe("Quadra 1");
      // E o preço sai como número, como no resto da gestão: `Decimal` do
      // Prisma não atravessa JSON de um jeito que a tela saiba ler.
      expect(saida.precoHora).toBe(80);
    });

    it("quadra de outra arena é 404, e não devolve nulo", async () => {
      // Devolver `null` empurraria a decisão para a tela, que mostraria
      // formulário vazio em vez de dizer que não existe — e esconderia a
      // única informação útil: o id não é desta arena.
      const { servico: s } = servico({ quadraExistente: null });

      await expect(s.detalhe("e1", "q-de-outra")).rejects.toThrow(NotFoundException);
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

    it("converte cada quadra da lista, e não só a primeira", async () => {
      // O teste acima roda com lista vazia, de modo que a conversão nunca
      // acontecia. Duas quadras aqui porque "converte a lista" e "converte
      // um item" são afirmações diferentes.
      const { servico: s, prisma } = servico();
      const base = {
        descricao: null,
        capacidade: 4,
        fotos: [],
        comodidades: [],
        ativo: true,
        createdAt: new Date("2026-09-29T12:00:00.000Z"),
        modalidades: [{ nome: "Beach Tennis" }],
        faixasPreco: [],
      };
      (prisma.quadra.findMany as jest.Mock).mockResolvedValue([
        { ...base, id: "q1", nome: "Quadra 1", precoHora: new Prisma.Decimal(80) },
        { ...base, id: "q2", nome: "Quadra 2", precoHora: new Prisma.Decimal(95.5) },
      ]);

      const saida = await s.listar("e1");

      expect(saida.map((q) => q.nome)).toEqual(["Quadra 1", "Quadra 2"]);
      expect(saida.map((q) => q.precoHora)).toEqual([80, 95.5]);
    });
  });
});
