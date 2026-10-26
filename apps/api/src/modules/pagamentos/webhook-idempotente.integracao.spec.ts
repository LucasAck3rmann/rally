// SPDX-License-Identifier: AGPL-3.0-or-later
import { Prisma, PrismaClient, ReservaStatus } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { NotificacoesService } from "../notificacoes/notificacoes.service";
import { PagamentosService } from "./pagamentos.service";
import { PixProvider } from "./pix-provider";

/**
 * Prova que o webhook de pagamento é **idempotente** contra um Postgres de
 * verdade (RNF-10).
 *
 * **Por que não bastam os testes com mock.** A suíte unitária encena a
 * corrida pela contagem que o `updateMany` devolve, o que prova o que o
 * serviço faz *dado* o resultado do banco — mas não prova que o banco
 * devolve aquele resultado. A diferença não é acadêmica: ao tirar
 * `pagoEm: null` do `where`, por mutação, só o teste estrutural reprovou; os
 * de comportamento continuaram verdes, porque o mock respondia a mesma
 * contagem de qualquer jeito. **É exatamente a brecha que este arquivo
 * fecha**, e foi uma mutação que a revelou.
 *
 * A entrega repetida é feita **em paralelo**, como o teste de corrida do
 * cupom: a reentrega real costuma ser sequencial, mas a propriedade forte é
 * a concorrente, e quem passa nela passa na outra.
 *
 * Sem `DATABASE_URL` a suíte é pulada, para que `pnpm test` continue rodando
 * numa máquina sem banco; a CI levanta um Postgres e roda de fato.
 *
 * Exige o schema migrado e semeado:
 *   pnpm prisma migrate deploy && pnpm prisma db seed
 */
const comBanco = process.env.DATABASE_URL ? describe : describe.skip;

/** Prefixo dos ids criados aqui, para a limpeza não encostar no seed. */
const PREFIXO = "teste-webhook-";

comBanco("webhook de pagamento é idempotente (integração)", () => {
  const prisma = new PrismaClient();
  let estabelecimentoId = "";
  let quadraId = "";
  let clienteId = "";

  /** Chama o serviço real com Prisma real; só as portas externas são falsas. */
  function servico() {
    const registrar = jest.fn().mockResolvedValue(undefined);
    const instancia = new PagamentosService(
      prisma as unknown as PrismaService,
      { criarCobranca: jest.fn() } as unknown as PixProvider,
      { registrar } as unknown as NotificacoesService,
    );
    return { instancia, registrar };
  }

  /** Reserva pendente com cobrança aberta, que é o estado que o Pix cria. */
  async function reservaPendente(sufixo: string, hora: number) {
    const inicio = new Date(Date.UTC(2031, 0, 1, hora, 0, 0));
    const fim = new Date(Date.UTC(2031, 0, 1, hora + 1, 0, 0));
    const reserva = await prisma.reserva.create({
      data: {
        id: `${PREFIXO}r-${sufixo}`,
        estabelecimentoId,
        quadraId,
        clienteId,
        inicio,
        fim,
        preco: new Prisma.Decimal(80),
        status: ReservaStatus.PENDENTE_PAGAMENTO,
      },
    });
    await prisma.pagamento.create({
      data: {
        id: `${PREFIXO}p-${sufixo}`,
        reservaId: reserva.id,
        gatewayId: `${PREFIXO}cob-${sufixo}`,
        valor: new Prisma.Decimal(80),
      },
    });
    return reserva;
  }

  const evento = (sufixo: string) => ({
    gatewayId: `${PREFIXO}cob-${sufixo}`,
    evento: "pagamento.pago",
  });

  beforeAll(async () => {
    const quadra = await prisma.quadra.findFirstOrThrow();
    quadraId = quadra.id;
    estabelecimentoId = quadra.estabelecimentoId;
    const cliente = await prisma.usuario.findFirstOrThrow();
    clienteId = cliente.id;

    // **Limpeza na entrada, e não só na saída.** Execução interrompida não
    // roda o `afterAll`, e os ids desta suíte são fixos: a volta seguinte
    // esbarraria neles e falharia na criação, antes de verificar coisa
    // alguma. O `gatewayId` sai junto porque é único.
    await prisma.pagamento.deleteMany({ where: { id: { startsWith: PREFIXO } } });
    await prisma.reserva.deleteMany({ where: { id: { startsWith: PREFIXO } } });
  });

  afterAll(async () => {
    await prisma.pagamento.deleteMany({ where: { id: { startsWith: PREFIXO } } });
    await prisma.reserva.deleteMany({ where: { id: { startsWith: PREFIXO } } });
    await prisma.$disconnect();
  });

  it("duas entregas do mesmo evento confirmam uma vez e avisam uma vez", async () => {
    const { instancia, registrar } = servico();
    await reservaPendente("dupla", 10);

    const primeira = await instancia.aplicarEvento(evento("dupla"));
    const segunda = await instancia.aplicarEvento(evento("dupla"));

    expect(primeira).toEqual({ aplicado: true, reservaConfirmada: true });
    expect(segunda).toEqual({ aplicado: false, jaEstavaPago: true });
    // **O que o cliente percebe:** um comprovante, não dois.
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it("a segunda entrega não mexe no instante do pagamento", async () => {
    // `pagoEm` é a hora em que o dinheiro entrou, e é por ela que o
    // relatório conta a receita do dia. Sobrescrever na reentrega moveria
    // uma venda de um dia para outro sem ninguém notar.
    const { instancia } = servico();
    await reservaPendente("instante", 11);

    await instancia.aplicarEvento(evento("instante"));
    const depoisDaPrimeira = await prisma.pagamento.findUniqueOrThrow({
      where: { id: `${PREFIXO}p-instante` },
    });

    await instancia.aplicarEvento(evento("instante"));
    const depoisDaSegunda = await prisma.pagamento.findUniqueOrThrow({
      where: { id: `${PREFIXO}p-instante` },
    });

    expect(depoisDaSegunda.pagoEm).toEqual(depoisDaPrimeira.pagoEm);
  });

  it("dez entregas simultâneas produzem exatamente uma confirmação", async () => {
    // A propriedade forte. Sem a condição no `where`, as dez leriam o mesmo
    // estado "não pago" e as dez executariam os efeitos.
    const ENTREGAS = 10;
    const { instancia, registrar } = servico();
    await reservaPendente("corrida", 12);

    const resultados = await Promise.all(
      Array.from({ length: ENTREGAS }, () => instancia.aplicarEvento(evento("corrida"))),
    );

    const aplicaram = resultados.filter((r) => r.aplicado);
    expect(aplicaram).toHaveLength(1);
    expect(registrar).toHaveBeenCalledTimes(1);

    const reserva = await prisma.reserva.findUniqueOrThrow({
      where: { id: `${PREFIXO}r-corrida` },
    });
    expect(reserva.status).toBe(ReservaStatus.CONFIRMADA);
  });

  it("pagamento que chega depois do cancelamento não ressuscita a reserva", async () => {
    // O caso real: o Pix expirou, o horário foi liberado, e o pagamento cai
    // depois. Confirmar aqui criaria duas reservas no mesmo horário, e a
    // restrição de exclusão recusaria — derrubando o webhook.
    const { instancia, registrar } = servico();
    await reservaPendente("tardio", 13);
    await prisma.reserva.update({
      where: { id: `${PREFIXO}r-tardio` },
      data: {
        status: ReservaStatus.CANCELADA,
        canceladaEm: new Date(),
        motivoCancelamento: "Pagamento Pix expirou sem confirmação.",
      },
    });

    const saida = await instancia.aplicarEvento(evento("tardio"));

    expect(saida.aplicado).toBe(true);
    expect(saida.reservaConfirmada).toBe(false);
    expect(registrar).not.toHaveBeenCalled();

    // O dinheiro fica registrado — some-lo seria pior — e o par aparece na
    // conciliação como `CANCELADA_PAGA`, para o dono estornar.
    const pagamento = await prisma.pagamento.findUniqueOrThrow({
      where: { id: `${PREFIXO}p-tardio` },
    });
    expect(pagamento.pagoEm).not.toBeNull();
    const reserva = await prisma.reserva.findUniqueOrThrow({
      where: { id: `${PREFIXO}r-tardio` },
    });
    expect(reserva.status).toBe(ReservaStatus.CANCELADA);
  });
});
