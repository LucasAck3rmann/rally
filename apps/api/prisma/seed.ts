// SPDX-License-Identifier: AGPL-3.0-or-later
// Seed de desenvolvimento do Rally. Rode com: pnpm --filter @rally/api db:seed
//
// Reproduz os dados das telas do Figma (Home, Detalhe, Replays) para o app
// mobile subir com conteúdo real. Idempotente: pode rodar quantas vezes quiser.
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

import { horaLocalParaUtc } from "../src/common/timezone";

const db = new PrismaClient();

/** Base pública da API — as fotos do seed são servidas de `public/fotos`. */
const BASE = process.env.API_PUBLIC_URL ?? "http://localhost:3333";
const foto = (arquivo: string) => `${BASE}/static/fotos/${arquivo}`;

/** Funcionamento seg–dom, 08:00–23:00 (a grade da tela vai até as 22:00). */
const FUNCIONAMENTO = [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
  diaSemana,
  abre: "08:00",
  fecha: "23:00",
}));

async function main() {
  const senha = await hash("rally123");

  const [beach, fute, volei] = await Promise.all([
    db.modalidade.upsert({
      where: { nome: "Beach Tennis" },
      update: {},
      create: { nome: "Beach Tennis", tipo: "BEACH_TENNIS" },
    }),
    db.modalidade.upsert({
      where: { nome: "Futevôlei" },
      update: {},
      create: { nome: "Futevôlei", tipo: "FUTEVOLEI" },
    }),
    db.modalidade.upsert({
      where: { nome: "Vôlei" },
      update: {},
      create: { nome: "Vôlei", tipo: "VOLEI" },
    }),
  ]);

  // ── Estabelecimento 1: Arena Beach Sapiranga ──────────────────────────────
  const arena = await db.estabelecimento.upsert({
    where: { slug: "arena-beach-sapiranga" },
    update: { nota: 4.9, avaliacoes: 128, bairro: "Centro" },
    create: {
      nome: "Arena Beach Sapiranga",
      slug: "arena-beach-sapiranga",
      bairro: "Centro",
      cidade: "Sapiranga",
      uf: "RS",
      nota: 4.9,
      avaliacoes: 128,
      plano: "PRO",
      descontoPixPct: 5,
      horarios: { create: FUNCIONAMENTO },
    },
  });

  const quadraArena = await upsertQuadra({
    estabelecimentoId: arena.id,
    nome: "Quadra 1",
    descricao:
      "Areia nivelada e iluminada, com vestiário e bar. Aluguel de raquetes e bolas no local. Ideal para jogos casuais e treinos.",
    precoHora: 80,
    capacidade: 4,
    comodidades: ["Vestiário", "Iluminação", "Bar", "Estacionamento", "Aluguel de raquete"],
    fotos: [foto("quadra-arena-hero.png"), foto("quadra-arena-beach.png")],
    modalidades: [beach.id, fute.id, volei.id],
    faixasPreco: [{ horaInicio: "18:00", horaFim: "23:00", precoHora: 110 }],
  });

  // ── Estabelecimento 2: Vila do Vôlei ──────────────────────────────────────
  const vila = await db.estabelecimento.upsert({
    where: { slug: "vila-do-volei" },
    update: { nota: 4.7, avaliacoes: 64, bairro: "São Luiz" },
    create: {
      nome: "Vila do Vôlei",
      slug: "vila-do-volei",
      bairro: "São Luiz",
      cidade: "Sapiranga",
      uf: "RS",
      nota: 4.7,
      avaliacoes: 64,
      plano: "FREE",
      descontoPixPct: 5,
      horarios: { create: FUNCIONAMENTO },
    },
  });

  await upsertQuadra({
    estabelecimentoId: vila.id,
    nome: "Quadra Areia 1",
    descricao: "Quadra de areia coberta, com rede oficial de futevôlei e arquibancada.",
    precoHora: 70,
    capacidade: 8,
    comodidades: ["Vestiário", "Iluminação", "Cobertura", "Estacionamento"],
    fotos: [foto("quadra-vila-volei.png")],
    modalidades: [fute.id, volei.id],
    faixasPreco: [],
  });

  // ── Usuários ──────────────────────────────────────────────────────────────
  const dono = await db.usuario.upsert({
    where: { email: "dono@arena.com" },
    update: {},
    create: {
      nome: "Lucas Ackermann",
      email: "dono@arena.com",
      senhaHash: senha,
      memberships: { create: { estabelecimentoId: arena.id, role: "ADMIN" } },
    },
  });

  const cliente = await db.usuario.upsert({
    where: { email: "cliente@rally.com" },
    update: {},
    create: {
      nome: "Lucas Ackermann",
      email: "cliente@rally.com",
      senhaHash: senha,
      notifPref: { create: { marketingOptIn: true } },
    },
  });

  // ── Promoção da Home ──────────────────────────────────────────────────────
  await db.promocao.upsert({
    where: {
      estabelecimentoId_codigo: {
        estabelecimentoId: arena.id,
        codigo: "BORAJOGAR",
      },
    },
    update: {},
    create: {
      estabelecimentoId: arena.id,
      codigo: "BORAJOGAR",
      tipo: "PERCENTUAL",
      valor: 20,
      validadeInicio: new Date(),
      validadeFim: new Date(Date.now() + 90 * 864e5),
      usosMax: 200,
    },
  });

  // ── Replays do cliente (tela de Replays) ──────────────────────────────────
  const clipes = [
    { arquivo: "replay-destaque.png", duracaoSeg: 42, diasAtras: 0 },
    { arquivo: "replay-1.png", duracaoSeg: 38, diasAtras: 1 },
    { arquivo: "replay-2.png", duracaoSeg: 25, diasAtras: 4 },
    { arquivo: "replay-3.png", duracaoSeg: 31, diasAtras: 6 },
  ];
  for (const clipe of clipes) {
    const s3Key = `seed/${clipe.arquivo}`;
    const existente = await db.replay.findFirst({ where: { s3Key } });
    if (existente) continue;
    await db.replay.create({
      data: {
        estabelecimentoId: arena.id,
        quadraId: quadraArena.id,
        clienteId: cliente.id,
        s3Key,
        url: foto(clipe.arquivo),
        duracaoSeg: clipe.duracaoSeg,
        status: "PRONTO",
        criadoEm: new Date(Date.now() - clipe.diasAtras * 864e5),
      },
    });
  }

  // ── Movimento: reservas, pagamentos, mensalista e trilha ──────────────
  //
  // **Sem isto o sistema sobe vazio, e tela vazia não demonstra produto.** O
  // painel dizia "nenhum movimento no período", a agenda não tinha o que
  // mostrar e a trilha abria em branco — as três telas que a pesquisa de
  // campo apontou como essenciais. As figuras do Relatório saem daqui.
  //
  // As datas são **relativas a hoje**, e não fixas: seed com data fixa
  // envelhece e volta a mostrar painel vazio semanas depois.
  await semearMovimento({
    estabelecimentoId: arena.id,
    quadraId: quadraArena.id,
    clienteId: cliente.id,
    donoId: dono.id,
    timezone: arena.timezone,
    precoHora: 80,
  });

  console.log("Seed concluído.");
  console.log(`  Estabelecimentos: ${arena.slug}, ${vila.slug}`);
  console.log(`  Login cliente: ${cliente.email} / rally123`);
  console.log(`  Login dono:    ${dono.email} / rally123`);
}

/**
 * Reservas, pagamentos, um mensalista e linhas de trilha.
 *
 * Roda uma vez: a marca é existir reserva da série no período. Repetir o
 * seed não duplica o movimento nem esbarra na `reserva_sem_sobreposicao`,
 * que recusaria a segunda tentativa no mesmo horário.
 */
async function semearMovimento(ctx: {
  estabelecimentoId: string;
  quadraId: string;
  clienteId: string;
  donoId: string;
  timezone: string;
  precoHora: number;
}) {
  const jaTem = await db.reserva.findFirst({
    where: { estabelecimentoId: ctx.estabelecimentoId },
    select: { id: true },
  });
  if (jaTem) return;

  /** "YYYY-MM-DD" de N dias a partir de hoje, no fuso da arena. */
  const dia = (desloc: number) => {
    const d = new Date(Date.now() + desloc * 864e5);
    return d.toISOString().slice(0, 10);
  };
  const quando = (desloc: number, hora: string) =>
    horaLocalParaUtc(dia(desloc), hora, ctx.timezone);

  // Uma semana com movimento de verdade: noite cheia nos dias úteis, manhã no
  // fim de semana, e três dias à frente para a agenda não abrir vazia.
  const AGENDA = [
    { desloc: -6, hora: "19:00", pago: true },
    { desloc: -5, hora: "20:00", pago: true },
    { desloc: -4, hora: "19:00", pago: true },
    { desloc: -3, hora: "21:00", pago: true },
    { desloc: -2, hora: "09:00", pago: true },
    { desloc: -1, hora: "20:00", pago: true },
    { desloc: 0, hora: "19:00", pago: true },
    { desloc: 0, hora: "20:00", pago: false },
    { desloc: 1, hora: "19:00", pago: false },
    { desloc: 2, hora: "20:00", pago: true },
  ];

  for (const item of AGENDA) {
    const inicio = quando(item.desloc, item.hora);
    const reserva = await db.reserva.create({
      data: {
        estabelecimentoId: ctx.estabelecimentoId,
        quadraId: ctx.quadraId,
        clienteId: ctx.clienteId,
        inicio,
        fim: new Date(inicio.getTime() + 60 * 60_000),
        status: "CONFIRMADA",
        origem: "APP",
        preco: ctx.precoHora,
      },
      select: { id: true },
    });
    // Reserva sem pagamento entra no relatório como **Balcão**, e é por isso
    // que duas ficam sem: a quebra por método precisa ter o caso.
    if (item.pago) {
      await db.pagamento.create({
        data: {
          reservaId: reserva.id,
          valor: ctx.precoHora,
          metodo: "PIX",
          status: "PAGO",
          pagoEm: new Date(inicio.getTime() - 2 * 864e5),
        },
      });
    }
  }

  // ── Mensalista (RF-36, ADR-0014) ──────────────────────────────────────────
  //
  // Terça às 19h, com as ocorrências materializadas pelas próximas semanas.
  // A tela de mensalistas mostra a folga do horizonte, e com a série vazia
  // não haveria folga para mostrar.
  const TERCA = 2;
  const serie = await db.recorrencia.create({
    data: {
      estabelecimentoId: ctx.estabelecimentoId,
      quadraId: ctx.quadraId,
      clienteId: ctx.clienteId,
      diaSemana: TERCA,
      horaInicio: "18:00",
      duracaoMinutos: 60,
      vigenciaInicio: new Date(`${dia(0)}T00:00:00.000Z`),
      preco: 70,
      observacao: "paga no dia 5, time do Augusto",
    },
    select: { id: true },
  });

  let materializadaAte: Date | null = null;
  for (let semana = 0; semana < 8; semana++) {
    const d = new Date(Date.now() + semana * 7 * 864e5);
    // Anda até a próxima terça a partir de hoje.
    while (d.getUTCDay() !== TERCA) d.setUTCDate(d.getUTCDate() + 1);
    const inicio = horaLocalParaUtc(
      d.toISOString().slice(0, 10),
      "18:00",
      ctx.timezone,
    );
    if (inicio <= new Date()) continue;
    try {
      await db.reserva.create({
        data: {
          estabelecimentoId: ctx.estabelecimentoId,
          quadraId: ctx.quadraId,
          clienteId: ctx.clienteId,
          inicio,
          fim: new Date(inicio.getTime() + 60 * 60_000),
          status: "CONFIRMADA",
          origem: "BALCAO",
          preco: 70,
          recorrenciaId: serie.id,
        },
      });
      materializadaAte = inicio;
    } catch {
      // Horário já ocupado nessa semana: a série pula e segue, como manda o
      // ADR-0014. Aqui só não avança o horizonte.
    }
  }
  if (materializadaAte) {
    await db.recorrencia.update({
      where: { id: serie.id },
      data: { materializadaAte },
    });
  }

  // ── Trilha de auditoria (RN-05) ───────────────────────────────────────────
  //
  // As linhas nascem do decorador `@Auditar` em uso real; aqui entram
  // direto, porque a tela precisa de histórico para mostrar o que faz.
  const TRILHA = [
    { acao: "criar mensalista", entidade: "Reserva", diasAtras: 0 },
    { acao: "liberar horário", entidade: "Reserva", diasAtras: 1 },
    { acao: "pausar quadra", entidade: "Quadra", diasAtras: 2 },
    { acao: "criar cupom", entidade: "Promocao", diasAtras: 3 },
    { acao: "trocar papel", entidade: "Membership", diasAtras: 5 },
  ];
  for (const linha of TRILHA) {
    await db.auditLog.create({
      data: {
        estabelecimentoId: ctx.estabelecimentoId,
        autorId: ctx.donoId,
        acao: linha.acao,
        entidade: linha.entidade,
        criadoEm: new Date(Date.now() - linha.diasAtras * 864e5),
      },
    });
  }
}

/** Cria a quadra na primeira execução e atualiza os dados nas seguintes. */
async function upsertQuadra(dados: {
  estabelecimentoId: string;
  nome: string;
  descricao: string;
  precoHora: number;
  capacidade: number;
  comodidades: string[];
  fotos: string[];
  modalidades: string[];
  faixasPreco: { horaInicio: string; horaFim: string; precoHora: number }[];
}) {
  const existente = await db.quadra.findFirst({
    where: { estabelecimentoId: dados.estabelecimentoId, nome: dados.nome },
    select: { id: true },
  });

  const comum = {
    descricao: dados.descricao,
    precoHora: dados.precoHora,
    capacidade: dados.capacidade,
    comodidades: dados.comodidades,
    fotos: dados.fotos,
    modalidades: { set: dados.modalidades.map((id) => ({ id })) },
  };

  if (existente) {
    return db.quadra.update({ where: { id: existente.id }, data: comum });
  }

  return db.quadra.create({
    data: {
      ...comum,
      estabelecimentoId: dados.estabelecimentoId,
      nome: dados.nome,
      modalidades: { connect: dados.modalidades.map((id) => ({ id })) },
      faixasPreco: { create: dados.faixasPreco },
    },
  });
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    void db.$disconnect();
    process.exit(1);
  });
