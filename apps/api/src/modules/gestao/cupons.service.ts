// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PromocaoTipo } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { AtualizarCupomDto, CriarCupomDto } from "./dto/cupom-gestao.dto";

/** Cupom como o painel precisa ver — inclusive os vencidos e desligados. */
const CUPOM_DA_GESTAO = {
  id: true,
  codigo: true,
  tipo: true,
  valor: true,
  validadeInicio: true,
  validadeFim: true,
  usosMax: true,
  usosFeitos: true,
  ativo: true,
  createdAt: true,
} satisfies Prisma.PromocaoSelect;

type CupomDaGestao = Prisma.PromocaoGetPayload<{
  select: typeof CUPOM_DA_GESTAO;
}>;

/**
 * Gestão de cupons do estabelecimento (RF-25).
 *
 * O consumo do cupom já existia (RF-14, em `reservas`); o que faltava era o
 * dono conseguir **fazer** um. Até aqui só o seed criava promoção, o que
 * tornava o recurso inútil fora de demonstração.
 *
 * Cupom usado **não se apaga**. Ele está apontado por `Reserva.promocaoId`,
 * e apagar faria sumir de onde veio o desconto de uma reserva paga — o
 * relatório passaria a mostrar um preço que ninguém consegue explicar.
 * Desligar (`ativo: false`) tira de circulação e preserva a história.
 */
@Injectable()
export class CuponsService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(estabelecimentoId: string) {
    const cupons = await this.prisma.promocao.findMany({
      where: { estabelecimentoId },
      select: CUPOM_DA_GESTAO,
      orderBy: [{ ativo: "desc" }, { createdAt: "desc" }],
    });
    return cupons.map((c) => this.paraDto(c));
  }

  async criar(estabelecimentoId: string, dto: CriarCupomDto) {
    const { inicio, fim } = this.validarJanela(
      new Date(dto.validadeInicio),
      new Date(dto.validadeFim),
    );
    this.validarValor(dto.tipo, dto.valor);

    try {
      const criado = await this.prisma.promocao.create({
        data: {
          estabelecimentoId,
          // Guardado em maiúsculas para a lista do painel não mostrar o mesmo
          // cupom escrito de três jeitos. A conferência na reserva já ignora
          // a caixa, então isto é cosmético — e é por isso que pode ser feito.
          codigo: dto.codigo.trim().toUpperCase(),
          tipo: dto.tipo,
          valor: new Prisma.Decimal(dto.valor),
          validadeInicio: inicio,
          validadeFim: fim,
          usosMax: dto.usosMax ?? null,
        },
        select: CUPOM_DA_GESTAO,
      });
      return this.paraDto(criado);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        throw new ConflictException("Já existe um cupom com esse código nesta arena.");
      }
      throw erro;
    }
  }

  async atualizar(estabelecimentoId: string, cupomId: string, dto: AtualizarCupomDto) {
    const atual = await this.prisma.promocao.findFirst({
      // Escopado pelo estabelecimento da rota (ADR-0011): sem isso, um admin
      // editaria o cupom de outra arena sabendo o id.
      where: { id: cupomId, estabelecimentoId },
      select: CUPOM_DA_GESTAO,
    });
    if (!atual) throw new NotFoundException("Cupom não encontrado.");

    const tipo = dto.tipo ?? atual.tipo;
    if (dto.valor !== undefined || dto.tipo !== undefined) {
      this.validarValor(tipo, dto.valor ?? Number(atual.valor));
    }

    const inicio =
      dto.validadeInicio !== undefined ? new Date(dto.validadeInicio) : atual.validadeInicio;
    const fim = dto.validadeFim !== undefined ? new Date(dto.validadeFim) : atual.validadeFim;
    // `inicio` e `fim` já são `Date`; passá-los como texto obrigava o
    // `toISOString()`, que **estoura `RangeError` em `Invalid Date`** — antes
    // de o guarda poder recusar. Era 500 onde a resposta é 400.
    this.validarJanela(inicio, fim);

    if (dto.usosMax !== undefined && dto.usosMax !== null && dto.usosMax < atual.usosFeitos) {
      // A restrição do banco recusaria do mesmo jeito; recusar aqui devolve
      // o número que o dono precisa saber em vez de um erro de constraint.
      throw new BadRequestException(
        `Esse cupom já foi usado ${atual.usosFeitos} vez(es); o limite não pode ser menor.`,
      );
    }

    const atualizado = await this.prisma.promocao.update({
      where: { id: cupomId },
      data: {
        tipo: dto.tipo,
        valor: dto.valor === undefined ? undefined : new Prisma.Decimal(dto.valor),
        validadeInicio: dto.validadeInicio === undefined ? undefined : inicio,
        validadeFim: dto.validadeFim === undefined ? undefined : fim,
        usosMax: dto.usosMax,
        ativo: dto.ativo,
      },
      select: CUPOM_DA_GESTAO,
    });
    return this.paraDto(atualizado);
  }

  /**
   * Começo e fim válidos, ou a recusa com o motivo.
   *
   * **Recebe `Date` e não texto**, e a diferença custou um defeito. Antes, o
   * `atualizar` já tinha convertido as pontas e as passava de volta como
   * texto com `toISOString()` — que **estoura `RangeError: Invalid time
   * value`** quando a data não presta. O erro subia como 500 antes de este
   * guarda rodar, de modo que `?validadeInicio=primeiro de abril` derrubava
   * a rota em vez de receber "Datas inválidas".
   *
   * O `criar` sempre funcionou porque passava o texto do DTO direto. Tomar
   * `Date` resolve os dois: some a conversão em dobro e o guarda passa a ser
   * alcançável pelos dois caminhos.
   */
  private validarJanela(inicio: Date, fim: Date) {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      throw new BadRequestException("Datas inválidas.");
    }
    if (fim <= inicio) {
      throw new BadRequestException("O fim da validade precisa ser depois do começo.");
    }
    return { inicio, fim };
  }

  private validarValor(tipo: PromocaoTipo, valor: number): void {
    // Cupom de 120% devolveria dinheiro a quem reserva. A regra de preço já
    // limita o desconto ao valor da quadra, mas aceitar o número aqui
    // deixaria o painel exibindo uma promoção que não significa nada.
    if (tipo === PromocaoTipo.PERCENTUAL && valor > 100) {
      throw new BadRequestException("Um desconto percentual não passa de 100%.");
    }
  }

  private paraDto(c: CupomDaGestao) {
    const agora = new Date();
    const esgotado = c.usosMax !== null && c.usosFeitos >= c.usosMax;
    return {
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo,
      valor: Number(c.valor),
      validadeInicio: c.validadeInicio.toISOString(),
      validadeFim: c.validadeFim.toISOString(),
      usosMax: c.usosMax,
      usosFeitos: c.usosFeitos,
      ativo: c.ativo,
      // Estado derivado vem pronto: a tela não precisa repetir a regra de
      // "está valendo?", e a lista do painel e a recusa na reserva não
      // podem discordar sobre o mesmo cupom.
      vigente: c.ativo && !esgotado && agora >= c.validadeInicio && agora <= c.validadeFim,
      esgotado,
      vencido: agora > c.validadeFim,
      createdAt: c.createdAt.toISOString(),
    };
  }
}
