// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { emMinutos } from "../../common/timezone";
import { PrismaService } from "../../prisma/prisma.service";
import { AtualizarQuadraDto } from "./dto/atualizar-quadra.dto";
import { CriarQuadraDto } from "./dto/criar-quadra.dto";
import { FaixaPrecoDto } from "./dto/faixa-preco.dto";

/** Quadra como a tela de gestão precisa ver — inclusive as pausadas. */
const QUADRA_DA_GESTAO = {
  id: true,
  nome: true,
  descricao: true,
  precoHora: true,
  capacidade: true,
  fotos: true,
  comodidades: true,
  ativo: true,
  createdAt: true,
  modalidades: { select: { nome: true } },
  faixasPreco: {
    select: {
      id: true,
      diaSemana: true,
      horaInicio: true,
      horaFim: true,
      precoHora: true,
    },
    orderBy: { horaInicio: "asc" },
  },
} satisfies Prisma.QuadraSelect;

type QuadraDaGestao = Prisma.QuadraGetPayload<{
  select: typeof QUADRA_DA_GESTAO;
}>;

@Injectable()
export class QuadrasGestaoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quadras do estabelecimento, ativas e pausadas.
   *
   * Toda query daqui pra baixo carrega `estabelecimentoId` no `where` — é o
   * que garante o isolamento entre tenants do ADR-0011.
   */
  async listar(estabelecimentoId: string) {
    const quadras = await this.prisma.quadra.findMany({
      where: { estabelecimentoId },
      select: QUADRA_DA_GESTAO,
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });
    return quadras.map((q) => this.paraDto(q));
  }

  async detalhe(estabelecimentoId: string, quadraId: string) {
    const quadra = await this.prisma.quadra.findFirst({
      where: { id: quadraId, estabelecimentoId },
      select: QUADRA_DA_GESTAO,
    });
    if (!quadra) {
      throw new NotFoundException("Quadra não encontrada.");
    }
    return this.paraDto(quadra);
  }

  async criar(estabelecimentoId: string, dto: CriarQuadraDto) {
    const modalidades = await this.resolverModalidades(dto.modalidades);
    this.validarFaixas(dto.faixasPreco);

    const quadra = await this.prisma.quadra.create({
      data: {
        estabelecimentoId,
        nome: dto.nome,
        descricao: dto.descricao,
        precoHora: new Prisma.Decimal(dto.precoHora),
        capacidade: dto.capacidade,
        comodidades: dto.comodidades ?? [],
        fotos: dto.fotos ?? [],
        modalidades: { connect: modalidades.map((id) => ({ id })) },
        faixasPreco: { create: dto.faixasPreco ?? [] },
      },
      select: QUADRA_DA_GESTAO,
    });
    return this.paraDto(quadra);
  }

  /**
   * Edita a quadra. As faixas de preço são trocadas por inteiro quando vêm no
   * corpo — comparar faixa a faixa não valeria a complexidade, e a tela de
   * gestão sempre envia a lista completa.
   */
  async atualizar(
    estabelecimentoId: string,
    quadraId: string,
    dto: AtualizarQuadraDto,
  ) {
    const existe = await this.prisma.quadra.findFirst({
      where: { id: quadraId, estabelecimentoId },
      select: { id: true },
    });
    if (!existe) {
      throw new NotFoundException("Quadra não encontrada.");
    }

    const modalidades = dto.modalidades
      ? await this.resolverModalidades(dto.modalidades)
      : undefined;
    this.validarFaixas(dto.faixasPreco);

    const quadra = await this.prisma.$transaction(async (tx) => {
      if (dto.faixasPreco) {
        await tx.faixaPreco.deleteMany({ where: { quadraId } });
      }
      return tx.quadra.update({
        where: { id: quadraId },
        data: {
          nome: dto.nome,
          descricao: dto.descricao,
          precoHora:
            dto.precoHora === undefined
              ? undefined
              : new Prisma.Decimal(dto.precoHora),
          capacidade: dto.capacidade,
          comodidades: dto.comodidades,
          fotos: dto.fotos,
          ativo: dto.ativo,
          modalidades: modalidades
            ? { set: modalidades.map((id) => ({ id })) }
            : undefined,
          faixasPreco: dto.faixasPreco
            ? { create: dto.faixasPreco }
            : undefined,
        },
        select: QUADRA_DA_GESTAO,
      });
    });

    return this.paraDto(quadra);
  }

  /**
   * Traduz nomes de modalidade em ids. Modalidade é vocabulário compartilhado
   * da plataforma, então nome desconhecido é erro do cliente — não motivo para
   * criar uma modalidade nova a partir de texto livre.
   */
  private async resolverModalidades(nomes: string[]): Promise<string[]> {
    const unicos = [...new Set(nomes.map((n) => n.trim()))];
    const encontradas = await this.prisma.modalidade.findMany({
      where: { nome: { in: unicos } },
      select: { id: true, nome: true },
    });

    if (encontradas.length !== unicos.length) {
      const conhecidas = new Set(encontradas.map((m) => m.nome));
      const faltando = unicos.filter((n) => !conhecidas.has(n));
      throw new BadRequestException(
        `Modalidade não cadastrada: ${faltando.join(", ")}.`,
      );
    }
    return encontradas.map((m) => m.id);
  }

  /** Cada faixa precisa terminar depois de começar e não pode colidir. */
  private validarFaixas(faixas: FaixaPrecoDto[] | undefined): void {
    if (!faixas?.length) return;

    for (const faixa of faixas) {
      if (emMinutos(faixa.horaFim) <= emMinutos(faixa.horaInicio)) {
        throw new BadRequestException(
          `Faixa de preço inválida: ${faixa.horaInicio}–${faixa.horaFim} termina antes de começar.`,
        );
      }
    }

    // Duas faixas do mesmo dia não podem se sobrepor: o preço do slot ficaria
    // indefinido (a busca pega a primeira que casar).
    for (let i = 0; i < faixas.length; i++) {
      for (let j = i + 1; j < faixas.length; j++) {
        const a = faixas[i];
        const b = faixas[j];
        const mesmoDia =
          a.diaSemana === undefined ||
          b.diaSemana === undefined ||
          a.diaSemana === b.diaSemana;
        const sobrepoe =
          emMinutos(a.horaInicio) < emMinutos(b.horaFim) &&
          emMinutos(b.horaInicio) < emMinutos(a.horaFim);

        if (mesmoDia && sobrepoe) {
          throw new BadRequestException(
            `Faixas de preço se sobrepõem: ${a.horaInicio}–${a.horaFim} e ${b.horaInicio}–${b.horaFim}.`,
          );
        }
      }
    }
  }

  private paraDto(q: QuadraDaGestao) {
    return {
      id: q.id,
      nome: q.nome,
      descricao: q.descricao,
      precoHora: Number(q.precoHora),
      capacidade: q.capacidade,
      fotos: q.fotos,
      comodidades: q.comodidades,
      ativo: q.ativo,
      criadaEm: q.createdAt.toISOString(),
      modalidades: q.modalidades.map((m) => m.nome),
      faixasPreco: q.faixasPreco.map((f) => ({
        id: f.id,
        diaSemana: f.diaSemana,
        horaInicio: f.horaInicio,
        horaFim: f.horaFim,
        precoHora: Number(f.precoHora),
      })),
    };
  }
}
