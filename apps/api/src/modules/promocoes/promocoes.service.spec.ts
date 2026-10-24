// SPDX-License-Identifier: AGPL-3.0-or-later
import { PromocaoTipo } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { PromocoesService } from "./promocoes.service";

/**
 * A promoção em destaque da Home do aplicativo (RF-06).
 *
 * **Este serviço estava com 0% de cobertura de ramos** — sete decisões, e
 * nenhuma exercitada. Não é cobertura baixa espalhada: é um serviço inteiro
 * cujo caminho de decisão nunca foi percorrido, e ele decide duas coisas que
 * a tela mostra: **qual** cupom aparece e **como** o texto dele é escrito.
 *
 * As duas merecem teste pela mesma razão. A escolha depende de uso
 * disponível, e cupom esgotado em destaque é promessa que a reserva recusa;
 * o texto é regra de formatação que o serviço declara morar aqui, e não na
 * interface — se mora aqui, é aqui que se confere.
 */
describe("PromocoesService — o destaque da Home", () => {
  const findMany = jest.fn();
  const prisma = { promocao: { findMany } } as unknown as PrismaService;
  const service = new PromocoesService(prisma);

  beforeEach(() => jest.clearAllMocks());

  /** Uma promoção no ar, com os campos que o `select` do serviço pede. */
  function promocao(mudancas: Record<string, unknown> = {}) {
    return {
      codigo: "BEMVINDO",
      tipo: PromocaoTipo.PERCENTUAL,
      valor: 10,
      usosMax: null as number | null,
      usosFeitos: 0,
      estabelecimento: { nome: "Arena Central" },
      ...mudancas,
    };
  }

  it("sem promoção no ar, não há destaque", async () => {
    findMany.mockResolvedValueOnce([]);
    expect(await service.destaque()).toBeNull();
  });

  it("promoção esgotada não vira destaque", async () => {
    // Anunciar na Home um cupom que a reserva vai recusar é prometer o que
    // não se cumpre.
    findMany.mockResolvedValueOnce([promocao({ usosMax: 50, usosFeitos: 50 })]);
    expect(await service.destaque()).toBeNull();
  });

  it("`usosMax` nulo é ilimitada, e entra", async () => {
    findMany.mockResolvedValueOnce([promocao({ usosMax: null, usosFeitos: 9999 })]);
    expect(await service.destaque()).not.toBeNull();
  });

  it("escolhe a primeira **com uso disponível**, e não a primeira da lista", async () => {
    // A consulta traz cinco por recência; a esgotada é a mais recente. Sem
    // este teste, trocar o `find` por um `[0]` passaria despercebido.
    findMany.mockResolvedValueOnce([
      promocao({ codigo: "ESGOTADA", usosMax: 1, usosFeitos: 1 }),
      promocao({ codigo: "DISPONIVEL", usosMax: 10, usosFeitos: 3 }),
    ]);
    expect((await service.destaque())?.codigo).toBe("DISPONIVEL");
  });

  it("percentual vira “% OFF”, com o selo de porcentagem", async () => {
    findMany.mockResolvedValueOnce([promocao({ tipo: PromocaoTipo.PERCENTUAL, valor: 25 })]);

    const d = await service.destaque();

    expect(d?.titulo).toBe("Primeira hora com 25% OFF");
    expect(d?.selo).toBe("%");
    expect(d?.chamada).toBe("Use o cupom BEMVINDO");
    expect(d?.estabelecimento).toBe("Arena Central");
  });

  it("valor fixo vira “R$ de desconto”, com o selo de real", async () => {
    findMany.mockResolvedValueOnce([promocao({ tipo: PromocaoTipo.VALOR_FIXO, valor: 30 })]);

    const d = await service.destaque();

    expect(d?.titulo).toBe("R$ 30 de desconto na primeira hora");
    expect(d?.selo).toBe("R$");
  });

  it("o valor é arredondado sem centavos, porque é texto de vitrine", async () => {
    findMany.mockResolvedValueOnce([promocao({ tipo: PromocaoTipo.VALOR_FIXO, valor: 19.9 })]);
    expect((await service.destaque())?.titulo).toBe("R$ 20 de desconto na primeira hora");
  });

  /**
   * O filtro é parte da promessa: cupom fora da validade, desligado ou de
   * estabelecimento inativo não pode aparecer na Home de ninguém. Como quem
   * garante isso é a consulta, é a consulta que este teste olha.
   */
  it("só procura cupom ativo, dentro da validade e de estabelecimento ativo", async () => {
    findMany.mockResolvedValueOnce([]);

    await service.destaque();

    const { where, orderBy, take } = findMany.mock.calls[0][0];
    expect(where.ativo).toBe(true);
    expect(where.estabelecimento).toEqual({ ativo: true });
    expect(where.validadeInicio.lte).toBeInstanceOf(Date);
    expect(where.validadeFim.gte).toBeInstanceOf(Date);
    expect(orderBy).toEqual({ createdAt: "desc" });
    expect(take).toBe(5);
  });
});
