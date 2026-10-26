// SPDX-License-Identifier: AGPL-3.0-or-later
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { NotificacaoTipo, PagamentoStatus, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { PagamentosService } from "./pagamentos.service";
import { PixProvider } from "./pix-provider";

/** 02/10/2026 às 08:00 em São Paulo (UTC-3). */
const INICIO = new Date("2026-10-02T11:00:00.000Z");

function reservaBase(extras: Record<string, unknown> = {}) {
  return {
    id: "r1",
    clienteId: "u1",
    inicio: INICIO,
    pagamento: { id: "p1" },
    quadra: {
      nome: "Quadra 1",
      estabelecimento: {
        nome: "Arena Beach Sapiranga",
        timezone: "America/Sao_Paulo",
      },
    },
    ...extras,
  };
}

/** A reserva como o webhook a enxerga: pela cobrança, sem o campo `pagamento`. */
function reservaDoPagamento(extras: Record<string, unknown> = {}) {
  const { pagamento: _pagamento, ...resto } = reservaBase(extras);
  return resto;
}

/**
 * Monta o serviço com uma transação **interativa** falsa.
 *
 * `contagens` decide o que o banco responde a cada `updateMany`, e é assim
 * que as duas corridas são encenadas: `pagamento: 0` significa "outra
 * entrega já marcou como pago" e `reserva: 0` significa "a reserva não
 * estava mais pendente". Encenar pela contagem, e não por um estado lido
 * antes, é o mesmo mecanismo que o código usa — um teste que lesse o estado
 * provaria outra coisa.
 */
function servico(
  opcoes: {
    reserva?: unknown;
    pagamento?: unknown;
    contagens?: { pagamento?: number; reserva?: number };
  } = {},
) {
  const contagens = { pagamento: 1, reserva: 1, ...opcoes.contagens };

  const pagamentoUpdateMany = jest.fn().mockResolvedValue({ count: contagens.pagamento });
  const reservaUpdateMany = jest.fn().mockResolvedValue({ count: contagens.reserva });
  const acharPagamento = jest.fn().mockResolvedValue(opcoes.pagamento ?? null);
  const registrar = jest.fn().mockResolvedValue(undefined);
  const criarCobranca = jest.fn().mockResolvedValue({ gatewayId: "g1" });

  const tx = {
    pagamento: { updateMany: pagamentoUpdateMany },
    reserva: { updateMany: reservaUpdateMany },
  };
  const transacao = jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => await cb(tx));

  const prisma = {
    reserva: { findUnique: jest.fn().mockResolvedValue(opcoes.reserva ?? null) },
    pagamento: { findUnique: acharPagamento },
    $transaction: transacao,
  } as unknown as PrismaService;

  const instancia = new PagamentosService(
    prisma,
    { criarCobranca } as unknown as PixProvider,
    { registrar } as unknown as NotificacoesService,
  );
  return {
    servico: instancia,
    pagamentoUpdateMany,
    reservaUpdateMany,
    acharPagamento,
    transacao,
    registrar,
    criarCobranca,
  };
}

describe("PagamentosService", () => {
  const ambienteOriginal = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ambienteOriginal;
  });

  describe("criarCobrancaPix", () => {
    it("delega ao provedor configurado", async () => {
      const { servico: s, criarCobranca } = servico({ reserva: reservaBase() });

      await s.criarCobrancaPix({
        reservaId: "r1",
        valor: 76,
        descricao: "Arena · Quadra 1",
        expiraEmMinutos: 30,
      });

      // A porta é o que permite trocar o provedor de desenvolvimento pela
      // AbacatePay sem tocar no domínio (ADR-0003).
      expect(criarCobranca).toHaveBeenCalledWith(
        expect.objectContaining({ reservaId: "r1", valor: 76 }),
      );
    });
  });

  describe("simularPagamento", () => {
    it("é bloqueado em produção", async () => {
      process.env.NODE_ENV = "production";
      const { servico: s, transacao } = servico({ reserva: reservaBase() });

      await expect(s.simularPagamento("r1", "u1")).rejects.toThrow(ForbiddenException);
      // O corte vem antes de qualquer escrita: em produção quem confirma é o
      // webhook do gateway, nunca uma chamada do app.
      expect(transacao).not.toHaveBeenCalled();
    });

    it("recusa reserva inexistente", async () => {
      const { servico: s } = servico({ reserva: null });

      await expect(s.simularPagamento("r1", "u1")).rejects.toThrow(NotFoundException);
    });

    it("recusa reserva sem cobrança", async () => {
      const { servico: s } = servico({
        reserva: reservaBase({ pagamento: null }),
      });

      await expect(s.simularPagamento("r1", "u1")).rejects.toThrow(NotFoundException);
    });

    it("recusa confirmar a reserva de outro cliente", async () => {
      const { servico: s, transacao } = servico({ reserva: reservaBase() });

      await expect(s.simularPagamento("r1", "outro")).rejects.toThrow(ForbiddenException);
      expect(transacao).not.toHaveBeenCalled();
    });

    it("marca a cobrança como paga e a reserva como confirmada, na mesma transação", async () => {
      const {
        servico: s,
        pagamentoUpdateMany,
        reservaUpdateMany,
        transacao,
      } = servico({ reserva: reservaBase() });

      const saida = await s.simularPagamento("r1", "u1");

      expect(saida).toMatchObject({
        status: PagamentoStatus.PAGO,
        aplicado: true,
        reservaConfirmada: true,
      });
      expect(pagamentoUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PagamentoStatus.PAGO }),
        }),
      );
      expect(reservaUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ReservaStatus.CONFIRMADA },
        }),
      );
      // As duas escritas vão juntas: pagamento pago com reserva pendente
      // seria dinheiro recebido sem horário garantido.
      expect(transacao).toHaveBeenCalledTimes(1);
    });

    it("passa pela mesma transição do webhook, e não por um caminho só dele", async () => {
      // **Antes havia dois caminhos para confirmar um pagamento**, e o de
      // desenvolvimento confirmava a reserva incondicionalmente — inclusive
      // uma já cancelada, que é justamente o caso que o do gateway recusa.
      // Um caminho só é o que faz o que eu exercito no app ser o que o
      // gateway executa.
      const { servico: s, registrar } = servico({
        reserva: reservaBase(),
        contagens: { reserva: 0 },
      });

      const saida = await s.simularPagamento("r1", "u1");

      expect(saida).toMatchObject({ aplicado: true, reservaConfirmada: false });
      expect(registrar).not.toHaveBeenCalled();
    });

    it("avisa o cliente da confirmação (RF-16)", async () => {
      const { servico: s, registrar } = servico({ reserva: reservaBase() });

      await s.simularPagamento("r1", "u1");

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: "u1",
          tipo: NotificacaoTipo.PAGAMENTO,
          titulo: "Pagamento confirmado",
          // Hora no fuso do estabelecimento, não no do servidor.
          corpo: "Arena Beach Sapiranga · Quadra 1 — 02/10, 08:00",
          destino: "/reservas/r1/confirmacao",
        }),
      );
    });

    it("o comprovante também sai por e-mail, com a mesma hora local", async () => {
      // É o aviso que mais justifica sair do aplicativo: comprovante é o
      // que a pessoa procura depois, e procura na caixa de entrada.
      const { servico: s, registrar } = servico({ reserva: reservaBase() });

      await s.simularPagamento("r1", "u1");

      const { email } = registrar.mock.calls[0][0];
      expect(email.assunto).toBe("Pagamento confirmado — Arena Beach Sapiranga");
      expect(email.texto).toContain("Quadra 1");
      expect(email.texto).toContain("02/10, 08:00");
    });

    it("não tenta avisar quando a reserva não tem cliente", async () => {
      // Reserva de balcão: existe horário, não existe a quem avisar.
      const {
        servico: s,
        registrar,
        transacao,
      } = servico({
        reserva: reservaBase({ clienteId: null }),
      });

      await expect(s.simularPagamento("r1", null as unknown as string)).resolves.toMatchObject({
        status: PagamentoStatus.PAGO,
      });
      expect(transacao).toHaveBeenCalled();
      expect(registrar).not.toHaveBeenCalled();
    });
  });

  describe("aplicarEvento — webhook do gateway (RNF-10)", () => {
    const pago = { gatewayId: "cob_1", evento: "pagamento.pago" };

    it("ignora evento que não trata, com 200 e sem tocar no banco", async () => {
      // 4xx faria o gateway reentregar para sempre ou marcar a entrega como
      // falha permanente. Nenhum dos dois diz "recebi, não se aplica".
      const { servico: s, acharPagamento, transacao } = servico();

      const saida = await s.aplicarEvento({
        gatewayId: "cob_1",
        evento: "pagamento.estornado",
      });

      expect(saida).toEqual({
        aplicado: false,
        motivo: "evento não tratado: pagamento.estornado",
      });
      expect(acharPagamento).not.toHaveBeenCalled();
      expect(transacao).not.toHaveBeenCalled();
    });

    it("recusa cobrança desconhecida com 404", async () => {
      // O `gatewayId` é gravado antes de o copia e cola chegar ao cliente,
      // de modo que não existe janela em que o evento chegue antes do
      // registro: desconhecido aqui é de outra conta ou configuração errada,
      // e as duas devem falhar alto em vez de virar um 200 que esconde.
      const { servico: s } = servico({ pagamento: null });

      await expect(s.aplicarEvento(pago)).rejects.toThrow(NotFoundException);
    });

    it("procura a cobrança pelo identificador do gateway, não pela reserva", async () => {
      const { servico: s, acharPagamento } = servico({
        pagamento: { id: "p1", reserva: reservaDoPagamento() },
      });

      await s.aplicarEvento(pago);

      expect(acharPagamento).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gatewayId: "cob_1" } }),
      );
    });

    it("confirma o pagamento e a reserva, e avisa uma vez", async () => {
      const { servico: s, registrar } = servico({
        pagamento: { id: "p1", reserva: reservaDoPagamento() },
      });

      const saida = await s.aplicarEvento(pago);

      expect(saida).toEqual({ aplicado: true, reservaConfirmada: true });
      expect(registrar).toHaveBeenCalledTimes(1);
    });

    it("a segunda entrega não manda um segundo e-mail", async () => {
      // **É a razão de a rota existir separada.** O gateway reentrega quando
      // não recebe 2xx — e também quando recebeu e o 2xx se perdeu no
      // caminho. O estado final não muda com a repetição; o que o cliente
      // percebe é o segundo "pagamento confirmado" na caixa de entrada.
      const {
        servico: s,
        registrar,
        reservaUpdateMany,
      } = servico({
        pagamento: { id: "p1", reserva: reservaDoPagamento() },
        contagens: { pagamento: 0 },
      });

      const saida = await s.aplicarEvento(pago);

      expect(saida).toEqual({ aplicado: false, jaEstavaPago: true });
      expect(registrar).not.toHaveBeenCalled();
      // E nem chega a mexer na reserva: perdida a corrida, nada depois dela
      // deve acontecer.
      expect(reservaUpdateMany).not.toHaveBeenCalled();
    });

    it("a condição da corrida vai no `where`, e não numa leitura anterior", async () => {
      // O mecanismo, não só o resultado: ler o estado e decidir abriria a
      // janela entre a leitura e a escrita, que é exatamente onde a segunda
      // entrega cabe.
      const { servico: s, pagamentoUpdateMany } = servico({
        pagamento: { id: "p1", reserva: reservaDoPagamento() },
      });

      await s.aplicarEvento(pago);

      expect(pagamentoUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "p1", pagoEm: null } }),
      );
    });

    it("não ressuscita reserva que já não estava pendente", async () => {
      // Acontece de verdade: o Pix expirou, o horário foi liberado e vendido
      // para outra pessoa, e o pagamento cai depois. Confirmar aqui criaria
      // duas reservas no mesmo horário, e a restrição de exclusão do banco
      // recusaria — derrubando o webhook.
      const {
        servico: s,
        registrar,
        reservaUpdateMany,
      } = servico({
        pagamento: { id: "p1", reserva: reservaDoPagamento() },
        contagens: { reserva: 0 },
      });

      const saida = await s.aplicarEvento(pago);

      expect(saida).toEqual({
        aplicado: true,
        reservaConfirmada: false,
        motivo: "reserva não estava pendente de pagamento",
      });
      // O pagamento fica pago e a reserva cancelada: o par aparece na
      // conciliação como `CANCELADA_PAGA`, que é do dono resolver.
      expect(registrar).not.toHaveBeenCalled();
      expect(reservaUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r1", status: ReservaStatus.PENDENTE_PAGAMENTO },
        }),
      );
    });

    it("não tenta avisar reserva de balcão", async () => {
      const { servico: s, registrar } = servico({
        pagamento: {
          id: "p1",
          reserva: reservaDoPagamento({ clienteId: null }),
        },
      });

      await expect(s.aplicarEvento(pago)).resolves.toEqual({
        aplicado: true,
        reservaConfirmada: true,
      });
      expect(registrar).not.toHaveBeenCalled();
    });
  });
});
