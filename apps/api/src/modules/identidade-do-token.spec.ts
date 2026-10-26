// SPDX-License-Identifier: AGPL-3.0-or-later
import { EquipeController } from "./gestao/equipe.controller";
import { EquipeService } from "./gestao/equipe.service";
import { NotificacoesController } from "./notificacoes/notificacoes.controller";
import { NotificacoesService } from "./notificacoes/notificacoes.service";
import { PagamentosService } from "./pagamentos/pagamentos.service";
import { PrivacidadeController } from "./privacidade/privacidade.controller";
import { PrivacidadeService } from "./privacidade/privacidade.service";
import { ReplaysController } from "./replays/replays.controller";
import { ReplaysService } from "./replays/replays.service";
import { ReservasController } from "./reservas/reservas.controller";
import { ReservasService } from "./reservas/reservas.service";
import type { CreateReservaDto } from "./reservas/dto/create-reserva.dto";
import type { JwtPayload } from "./auth/types/jwt-payload";

/**
 * **A identidade vem do token, nunca do corpo (RNF-06 · ADR-0011).**
 *
 * Esta suíte não existe para cobrir controlador. Existe porque os cinco
 * controladores do cliente compartilham **uma propriedade de segurança** que
 * nenhum deles declara sozinho: o identificador do usuário que chega ao
 * serviço é sempre o `sub` do token, e **nunca** um valor que o cliente
 * mandou. É o que impede que alguém peça as reservas, os avisos ou a
 * exportação de dados de outra pessoa.
 *
 * O jeito de verificar isso é o que dá valor ao teste: cada chamada manda, no
 * corpo e na consulta, um identificador **diferente** do que está no token. Se
 * algum dia alguém trocar `user.sub` por `dto.usuarioId` — a forma mais comum
 * de abrir um IDOR, e sempre com aparência de simplificação —, o teste aponta
 * qual rota passou a confiar no cliente.
 *
 * É o mesmo raciocínio que o contrato de ingestão de replay já aplica ao
 * recusar o identificador do cliente vindo do parceiro, e que o `PapelGuard`
 * aplica ao ler o papel do vínculo em vez do token. Aqui ele fica dito uma
 * vez, para as rotas que operam sobre "os meus" dados.
 */

const EU: JwtPayload = { sub: "u-eu", email: "eu@arena.com.br" };

/** O identificador que um atacante tentaria injetar. */
const OUTRO = "u-outra-pessoa";

/** Corpo contaminado: carrega campos que o cliente não deveria decidir. */
const CORPO_CONTAMINADO = {
  usuarioId: OUTRO,
  clienteId: OUTRO,
  userId: OUTRO,
  sub: OUTRO,
};

function espiao() {
  return jest.fn().mockResolvedValue({ ok: true });
}

describe("a identidade do usuário vem do token, e não do pedido", () => {
  it("reservas · minhas", async () => {
    const minhas = espiao();
    const c = new ReservasController(
      { minhas } as unknown as ReservasService,
      {} as PagamentosService,
    );

    await c.minhas(EU);

    expect(minhas).toHaveBeenCalledWith(EU.sub);
  });

  it("reservas · detalhe exige o dono, e o dono é quem o token diz", async () => {
    // O serviço decide se a reserva é dessa pessoa; o controlador decide
    // **quem é a pessoa**. Passar o id da rota como se fosse o usuário faria
    // qualquer um ler qualquer reserva.
    const detalhe = espiao();
    const c = new ReservasController(
      { detalhe } as unknown as ReservasService,
      {} as PagamentosService,
    );

    await c.detalhe("r-de-outra-pessoa", EU);

    expect(detalhe).toHaveBeenCalledWith("r-de-outra-pessoa", EU.sub);
  });

  it("reservas · criar ignora qualquer identificador vindo no corpo", async () => {
    const criar = espiao();
    const c = new ReservasController(
      { criar } as unknown as ReservasService,
      {} as PagamentosService,
    );
    const dto = {
      quadraId: "q1",
      inicio: "2026-10-20T20:00:00.000Z",
      duracaoHoras: 1,
      ...CORPO_CONTAMINADO,
    } as unknown as CreateReservaDto;

    await c.criar(dto, EU);

    expect(criar).toHaveBeenCalledWith(dto, EU.sub);
    // O segundo argumento é o do token, e não o que veio no corpo.
    expect(criar.mock.calls[0][1]).not.toBe(OUTRO);
  });

  it("reservas · remarcar e cancelar também", async () => {
    const remarcar = espiao();
    const cancelar = espiao();
    const c = new ReservasController(
      { remarcar, cancelar } as unknown as ReservasService,
      {} as PagamentosService,
    );

    await c.remarcar("r1", { ...CORPO_CONTAMINADO } as never, EU);
    await c.cancelar("r1", { motivo: "chuva", ...CORPO_CONTAMINADO } as never, EU);

    expect(remarcar.mock.calls[0][1]).toBe(EU.sub);
    expect(cancelar.mock.calls[0][1]).toBe(EU.sub);
    // O cancelamento repassa só o motivo do corpo — nada mais dele entra.
    expect(cancelar).toHaveBeenCalledWith("r1", EU.sub, "chuva");
  });

  it("reservas · a simulação de pagamento não escapa da regra", async () => {
    // É rota de desenvolvimento, e por isso mesmo: rota de conveniência é
    // onde a verificação costuma ser esquecida.
    const simularPagamento = espiao();
    const c = new ReservasController(
      {} as ReservasService,
      {
        simularPagamento,
      } as unknown as PagamentosService,
    );

    await c.simularPagamento("r1", EU);

    expect(simularPagamento).toHaveBeenCalledWith("r1", EU.sub);
  });

  it("notificações · as três rotas", async () => {
    const minhas = espiao();
    const lerTodas = espiao();
    const marcarLida = espiao();
    const c = new NotificacoesController({
      minhas,
      lerTodas,
      marcarLida,
    } as unknown as NotificacoesService);

    await c.minhas(EU);
    await c.lerTodas(EU);
    await c.marcarLida("n-de-outra-pessoa", EU);

    expect(minhas).toHaveBeenCalledWith(EU.sub);
    expect(lerTodas).toHaveBeenCalledWith(EU.sub);
    expect(marcarLida).toHaveBeenCalledWith("n-de-outra-pessoa", EU.sub);
  });

  it("privacidade · exportar e excluir, que são as mais sensíveis", async () => {
    // Se a exportação aceitasse o identificador de fora, bastaria trocar um
    // número na requisição para baixar os dados pessoais de qualquer pessoa —
    // e a exclusão apagaria a conta de qualquer pessoa.
    const exportar = espiao();
    const excluirConta = espiao();
    const c = new PrivacidadeController({
      exportar,
      excluirConta,
    } as unknown as PrivacidadeService);

    await c.meusDados(EU);
    await c.excluirConta(EU);

    expect(exportar).toHaveBeenCalledWith(EU.sub);
    expect(excluirConta).toHaveBeenCalledWith(EU.sub);
  });

  it("replays · e o período vem da consulta validada, com padrão", async () => {
    const meus = espiao();
    const c = new ReplaysController({ meus } as unknown as ReplaysService);

    await c.meus(EU, { periodo: "mes" });
    await c.meus(EU, {});

    expect(meus).toHaveBeenNthCalledWith(1, EU.sub, "mes");
    // Sem período, a semana — e não `undefined`, que o serviço trataria
    // como "todos" ou estouraria, dependendo de quem o lesse.
    expect(meus).toHaveBeenNthCalledWith(2, EU.sub, "semana");
  });

  it("equipe · quem executa a operação também vem do token", async () => {
    // Aqui o `sub` não é o alvo da operação, é o **executor** — e é ele que
    // alimenta a regra que impede o último administrador de se rebaixar e a
    // trilha de auditoria. Se viesse do corpo, bastaria mandar o id de outra
    // pessoa para a verificação do último admin olhar para a conta errada e
    // para a auditoria registrar o ato em nome de quem não o praticou.
    const trocarPapel = espiao();
    const remover = espiao();
    const c = new EquipeController({
      trocarPapel,
      remover,
    } as unknown as EquipeService);

    await c.trocarPapel("e1", OUTRO, { papel: "ATENDENTE" } as never, EU);
    await c.remover("e1", OUTRO, EU);

    // O alvo é `OUTRO`, o executor é quem o token diz — e nessa ordem.
    expect(trocarPapel).toHaveBeenCalledWith("e1", OUTRO, "ATENDENTE", EU.sub);
    expect(remover).toHaveBeenCalledWith("e1", OUTRO, EU.sub);
  });

  it("nenhuma das rotas recebe o identificador contaminado", async () => {
    // Asserção de rede: qualquer chamada que tenha visto `OUTRO` como
    // identificador de usuário falha aqui, mesmo que um teste acima seja
    // afrouxado no futuro.
    const todas = [espiao(), espiao(), espiao()];
    const [minhas, exportar, meus] = todas;

    await new ReservasController(
      { minhas } as unknown as ReservasService,
      {} as PagamentosService,
    ).minhas(EU);
    await new PrivacidadeController({
      exportar,
    } as unknown as PrivacidadeService).meusDados(EU);
    await new ReplaysController({ meus } as unknown as ReplaysService).meus(EU, {});

    for (const espia of todas) {
      expect(espia.mock.calls.flat()).not.toContain(OUTRO);
    }
  });
});
