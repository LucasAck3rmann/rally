// SPDX-License-Identifier: AGPL-3.0-or-later
// Seed de exemplo do Rally. Rode com: pnpm prisma db seed
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();

async function main() {
  // Estabelecimento + horário (seg–sáb 08:00–22:00)
  const estab = await db.estabelecimento.upsert({
    where: { slug: "arena-sapiranga" },
    update: {},
    create: {
      nome: "Arena Sapiranga",
      slug: "arena-sapiranga",
      cidade: "Sapiranga",
      uf: "RS",
      plano: "PRO",
      descontoPixPct: 5,
      horarios: {
        create: [1, 2, 3, 4, 5, 6].map((d) => ({
          diaSemana: d, abre: "08:00", fecha: "22:00",
        })),
      },
    },
  });

  // Modalidades
  const [beach, fute] = await Promise.all([
    db.modalidade.upsert({ where: { nome: "Beach Tennis" }, update: {},
      create: { nome: "Beach Tennis", tipo: "BEACH_TENNIS" } }),
    db.modalidade.upsert({ where: { nome: "Futevôlei" }, update: {},
      create: { nome: "Futevôlei", tipo: "FUTEVOLEI" } }),
  ]);

  // Quadra (com preço de pico 18h–22h)
  const quadra1 = await db.quadra.create({
    data: {
      estabelecimentoId: estab.id,
      nome: "Quadra 1",
      precoHora: 80,
      capacidade: 4,
      modalidades: { connect: [{ id: beach.id }, { id: fute.id }] },
      faixasPreco: { create: [{ horaInicio: "18:00", horaFim: "22:00", precoHora: 110 }] },
    },
  });

  // Usuários: admin (dono) + cliente
  const senha = await hash("rally123");
  const admin = await db.usuario.create({
    data: {
      nome: "Lucas (Dono)", email: "dono@arena.com", senhaHash: senha,
      memberships: { create: { estabelecimentoId: estab.id, role: "ADMIN" } },
    },
  });
  const cliente = await db.usuario.create({
    data: {
      nome: "Maria Cliente", email: "maria@email.com", senhaHash: senha,
      notifPref: { create: { marketingOptIn: true } },
    },
  });

  // Promoção
  await db.promocao.create({
    data: {
      estabelecimentoId: estab.id, codigo: "BEM-VINDO", tipo: "PERCENTUAL", valor: 10,
      validadeInicio: new Date(), validadeFim: new Date(Date.now() + 30 * 864e5), usosMax: 100,
    },
  });

  // Reserva confirmada + pagamento pago
  const inicio = new Date(); inicio.setHours(19, 0, 0, 0);
  const fim = new Date(inicio); fim.setHours(20, 0, 0, 0);
  await db.reserva.create({
    data: {
      estabelecimentoId: estab.id, quadraId: quadra1.id, clienteId: cliente.id,
      inicio, fim, status: "CONFIRMADA", origem: "APP", preco: 110,
      pagamento: { create: { valor: 104.5, metodo: "PIX", status: "PAGO", pagoEm: new Date() } },
    },
  });

  console.log("Seed concluído:", { estab: estab.slug, admin: admin.email });
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
