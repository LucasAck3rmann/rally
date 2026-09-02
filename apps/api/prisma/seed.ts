// SPDX-License-Identifier: AGPL-3.0-or-later
// Seed de desenvolvimento do Rally. Rode com: pnpm --filter @rally/api db:seed
//
// Reproduz os dados das telas do Figma (Home, Detalhe, Replays) para o app
// mobile subir com conteúdo real. Idempotente: pode rodar quantas vezes quiser.
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

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

  console.log("Seed concluído.");
  console.log(`  Estabelecimentos: ${arena.slug}, ${vila.slug}`);
  console.log(`  Login cliente: ${cliente.email} / rally123`);
  console.log(`  Login dono:    ${dono.email} / rally123`);
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
