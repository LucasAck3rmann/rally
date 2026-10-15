// SPDX-License-Identifier: AGPL-3.0-or-later
import { PromocaoTipo } from "@prisma/client";

/**
 * Regras do cupom de desconto (RN-14).
 *
 * Módulo puro, sem Prisma: a regra de preço é a parte que precisa ser
 * verificada caso a caso, e amarrá-la ao banco obrigaria cada caso a subir
 * um Postgres para ser testado.
 *
 * O que a RN-14 exige: validade, limite de usos, elegibilidade e **não
 * acumular com outro desconto, salvo configuração**. O único outro desconto
 * que existe hoje é o do Pix (RN-03), e é com ele que a soma é decidida
 * aqui.
 */

/** O que a regra precisa saber do cupom — nada além disto. */
export interface CupomParaAplicar {
  codigo: string;
  tipo: PromocaoTipo;
  /** Percentual quando `PERCENTUAL`; reais quando `VALOR_FIXO`. */
  valor: number;
  validadeInicio: Date;
  validadeFim: Date;
  usosMax: number | null;
  usosFeitos: number;
  ativo: boolean;
}

/**
 * Por que o cupom não vale — ou `null` quando vale.
 *
 * Devolve o motivo em vez de um booleano porque é o motivo que o cliente
 * precisa ler: "esse cupom venceu" e "esse cupom acabou" levam a ações
 * diferentes, e um "cupom inválido" genérico não leva a nenhuma.
 */
export function motivoDaRecusa(
  cupom: CupomParaAplicar,
  agora: Date,
): string | null {
  if (!cupom.ativo) return "Esse cupom não está mais disponível.";
  if (agora < cupom.validadeInicio) return "Esse cupom ainda não começou a valer.";
  if (agora > cupom.validadeFim) return "Esse cupom venceu.";
  // A checagem aqui é para responder rápido e explicar; quem garante o
  // limite é a restrição do banco, porque entre conferir e gravar cabe
  // outra reserva usando o último uso.
  if (cupom.usosMax !== null && cupom.usosFeitos >= cupom.usosMax) {
    return "Esse cupom já atingiu o limite de usos.";
  }
  return null;
}

/**
 * Quanto o cupom tira do preço, em reais.
 *
 * Nunca passa do preço: um cupom de R$ 100 numa quadra de R$ 80 zera a
 * conta, não gera crédito. Arredonda em duas casas porque é dinheiro.
 */
export function descontoDoCupom(
  cupom: CupomParaAplicar,
  precoBruto: number,
): number {
  const bruto =
    cupom.tipo === PromocaoTipo.PERCENTUAL
      ? (precoBruto * cupom.valor) / 100
      : cupom.valor;
  return Number(Math.min(Math.max(bruto, 0), precoBruto).toFixed(2));
}

/** Qual desconto acabou valendo, para a tela poder explicar a conta. */
export type DescontoAplicado =
  | { origem: "nenhum" }
  | { origem: "pix"; valor: number }
  | { origem: "cupom"; valor: number; codigo: string }
  | { origem: "pix+cupom"; valor: number; codigo: string };

export interface ContaDaReserva {
  /** Preço cheio do horário, antes de qualquer desconto. */
  precoBruto: number;
  /** `descontoPixPct` do estabelecimento; zero quando o método não é Pix. */
  descontoPixPct: number;
  cupom?: CupomParaAplicar;
  /** `cuponsAcumulam` do estabelecimento — o "salvo configuração" da RN-14. */
  acumulam: boolean;
}

/**
 * O valor a pagar e de onde veio o desconto.
 *
 * **Sem acumular, vale o maior desconto — e não o cupom por ser cupom.**
 * A RN-14 diz que os descontos não somam, mas não diz qual ganha. Deixar o
 * cupom ganhar sempre faria o cliente que digita um cupom de 5% numa arena
 * com 10% de desconto no Pix **pagar mais** por ter usado o cupom. Isso não
 * é regra de negócio, é defeito: ninguém escreve uma promoção para punir
 * quem a usa. Então ganha o maior, e a tela diz qual foi.
 *
 * Com `acumulam`, o cupom incide sobre o preço **já descontado** do Pix, e
 * não sobre o cheio: somar os dois percentuais sobre o bruto daria um
 * desconto maior do que qualquer um dos dois significa isoladamente.
 */
export function contaDaReserva(conta: ContaDaReserva): {
  valor: number;
  desconto: DescontoAplicado;
} {
  const { precoBruto, descontoPixPct, cupom, acumulam } = conta;
  const dinheiro = (n: number) => Number(n.toFixed(2));

  const pix = dinheiro((precoBruto * descontoPixPct) / 100);
  if (!cupom) {
    return {
      valor: dinheiro(precoBruto - pix),
      desconto: pix > 0 ? { origem: "pix", valor: pix } : { origem: "nenhum" },
    };
  }

  if (acumulam) {
    const doCupom = descontoDoCupom(cupom, dinheiro(precoBruto - pix));
    const total = dinheiro(pix + doCupom);
    return {
      valor: dinheiro(precoBruto - total),
      desconto:
        total > 0
          ? { origem: "pix+cupom", valor: total, codigo: cupom.codigo }
          : { origem: "nenhum" },
    };
  }

  const doCupom = descontoDoCupom(cupom, precoBruto);
  if (doCupom >= pix) {
    return {
      valor: dinheiro(precoBruto - doCupom),
      desconto:
        doCupom > 0
          ? { origem: "cupom", valor: doCupom, codigo: cupom.codigo }
          : { origem: "nenhum" },
    };
  }
  return {
    valor: dinheiro(precoBruto - pix),
    desconto: { origem: "pix", valor: pix },
  };
}
