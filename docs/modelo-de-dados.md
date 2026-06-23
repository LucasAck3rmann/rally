# Modelo de Dados — `schema.prisma` (v2) + seed

> Entidades do [§15 de Arquitetura](Arquitetura%20e%20Stack.md) em **schema Prisma** pronto pra `apps/api/prisma/schema.prisma`, agora com os campos de **configuração** que sustentam as regras de negócio ([Requisitos](requisitos.md) §5), **auth/OAuth**, **auditoria**, **preço por faixa**, **lista de espera** e **preferências de notificação** — mais um **seed** de exemplo. Multi-tenant por `estabelecimentoId` (estratégia detalhada em [ADR-0011 — Estratégia Multi-tenant](adr/0011-multi-tenant.md)). ORM em [Decisões de Arquitetura (ADRs)](adr/README.md) (ADR-0004).

## Decisões de modelagem
- **Multi-tenancy:** tudo pendura em **`Estabelecimento`** (o *tenant*); papéis em **`Membership`** (Usuario × Estabelecimento × Role).
- **Dinheiro:** `Decimal` — nunca `Float`. **IDs:** `cuid()`. **Horas:** `HorarioFuncionamento` guarda `"HH:mm"` (string) + timezone do estabelecimento.
- **Config por estabelecimento:** slot, antecedência, cancelamento e desconto Pix são **dados** (não código) — RN-02/03/07/08.
- **Anti-overbooking (RN-01):** `@@unique([quadraId, inicio])` como 1ª linha + **exclusion constraint** na migração (ver fim).
- **LGPD/auditoria:** `AuditLog` para ações sensíveis (RN-05); consentimento no `Usuario`; exclusão anonimiza (RN-18).

## `schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────── Enums ─────────────
enum Role { CLIENTE ATENDENTE FINANCEIRO ADMIN MANTENEDOR }
enum ModalidadeTipo { BEACH_TENNIS FUTEVOLEI VOLEI OUTRO }
enum ReservaStatus { PENDENTE_PAGAMENTO CONFIRMADA CANCELADA CONCLUIDA NO_SHOW BLOQUEIO }
enum ReservaOrigem { APP WEB BALCAO }
enum PagamentoMetodo { PIX CARTAO }
enum PagamentoStatus { PENDENTE PAGO EXPIRADO ESTORNADO FALHOU }
enum PromocaoTipo { PERCENTUAL VALOR_FIXO }
enum PlanoTipo { FREE PRO CLUBE }
enum ReplayStatus { PROCESSANDO PRONTO ERRO }

// ───────────── Núcleo / tenant ─────────────
model Estabelecimento {
  id                   String    @id @default(cuid())
  nome                 String
  slug                 String    @unique
  cnpj                 String?
  cidade               String?
  uf                   String?
  timezone             String    @default("America/Sao_Paulo")
  plano                PlanoTipo @default(FREE)
  ativo                Boolean   @default(true)
  // configuração (regras de negócio)
  slotMinutos          Int       @default(60)   // RN-08
  antecedenciaMinHoras Int       @default(1)    // RN-07
  antecedenciaMaxDias  Int       @default(30)   // RN-07
  cancelamentoHoras    Int       @default(12)   // RN-02
  descontoPixPct       Decimal   @default(0) @db.Decimal(5, 2) // RN-03
  pixExpiraMinutos     Int       @default(30)   // RN-13
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  quadras    Quadra[]
  membros    Membership[]
  horarios   HorarioFuncionamento[]
  reservas   Reserva[]
  materiais  Material[]
  promocoes  Promocao[]
  eventos    Evento[]
  replays    Replay[]
  auditLogs  AuditLog[]
}

model HorarioFuncionamento {
  id                String   @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  diaSemana         Int      // 0=domingo … 6=sábado
  abre              String   // "08:00"
  fecha             String   // "22:00"

  @@unique([estabelecimentoId, diaSemana])
}

model Usuario {
  id            String   @id @default(cuid())
  nome          String
  email         String   @unique
  senhaHash     String?  // null quando entra só por OAuth
  telefone      String?
  avatarUrl     String?
  consentLgpdEm DateTime?
  anonimizadoEm DateTime? // RN-18 (exclusão de conta)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  memberships   Membership[]
  reservas      Reserva[]            @relation("ReservaCliente")
  replays       Replay[]             @relation("ReplayCliente")
  accounts      Account[]
  refreshTokens RefreshToken[]
  notifPref     NotificationPreference?
  waitlist      WaitlistEntry[]
  auditLogs     AuditLog[]           @relation("AuditAutor")
}

// OAuth (Google/Instagram)
model Account {
  id                String  @id @default(cuid())
  usuario           Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId         String
  provider          String  // "google" | "instagram"
  providerAccountId String

  @@unique([provider, providerAccountId])
  @@index([usuarioId])
}

model RefreshToken {
  id         String    @id @default(cuid())
  usuario    Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId  String
  tokenHash  String    @unique
  expiraEm   DateTime
  revogadoEm DateTime?
  criadoEm   DateTime  @default(now())

  @@index([usuarioId])
}

model NotificationPreference {
  id            String  @id @default(cuid())
  usuario       Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId     String  @unique
  canalWhatsapp Boolean @default(true)
  canalEmail    Boolean @default(true)
  canalPush     Boolean @default(true)
  marketingOptIn Boolean @default(false) // LGPD: consentimento p/ marketing
}

// Papel do usuário DENTRO de um estabelecimento (RBAC + multi-papel)
model Membership {
  id                String   @id @default(cuid())
  usuario           Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId         String
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  role              Role     @default(CLIENTE)
  createdAt         DateTime @default(now())

  @@unique([usuarioId, estabelecimentoId])
  @@index([estabelecimentoId])
}

model Modalidade {
  id      String         @id @default(cuid())
  nome    String         @unique
  tipo    ModalidadeTipo @default(OUTRO)
  quadras Quadra[]       @relation("QuadraModalidade")
}

model Quadra {
  id                String   @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  nome              String
  descricao         String?
  precoHora         Decimal  @db.Decimal(10, 2) // preço base
  capacidade        Int?
  fotos             String[] // chaves S3
  ativo             Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  modalidades Modalidade[] @relation("QuadraModalidade")
  faixasPreco FaixaPreco[]
  reservas    Reserva[]
  replays     Replay[]
  waitlist    WaitlistEntry[]

  @@index([estabelecimentoId])
}

// Preço por faixa de horário/dia (RN-04 — pico/fora de pico)
model FaixaPreco {
  id         String  @id @default(cuid())
  quadra     Quadra  @relation(fields: [quadraId], references: [id], onDelete: Cascade)
  quadraId   String
  diaSemana  Int?    // null = todos os dias
  horaInicio String  // "18:00"
  horaFim    String  // "22:00"
  precoHora  Decimal @db.Decimal(10, 2)

  @@index([quadraId])
}

// ───────────── Reserva & pagamento ─────────────
model Reserva {
  id                 String        @id @default(cuid())
  estabelecimento    Estabelecimento @relation(fields: [estabelecimentoId], references: [id])
  estabelecimentoId  String
  quadra             Quadra        @relation(fields: [quadraId], references: [id])
  quadraId           String
  cliente            Usuario?      @relation("ReservaCliente", fields: [clienteId], references: [id])
  clienteId          String?       // null em BLOQUEIO
  inicio             DateTime
  fim                DateTime
  status             ReservaStatus @default(PENDENTE_PAGAMENTO)
  origem             ReservaOrigem @default(APP)
  preco              Decimal       @db.Decimal(10, 2) // congelado na criação (RN-12)
  promocao           Promocao?     @relation(fields: [promocaoId], references: [id])
  promocaoId         String?
  canceladaEm        DateTime?
  motivoCancelamento String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  pagamento Pagamento?
  replays   Replay[]

  // 1ª linha contra overbooking; trava real = exclusion constraint (ver fim)
  @@unique([quadraId, inicio])
  @@index([estabelecimentoId, inicio])
  @@index([quadraId, inicio, fim])
}

model Pagamento {
  id           String          @id @default(cuid())
  reserva      Reserva         @relation(fields: [reservaId], references: [id], onDelete: Cascade)
  reservaId    String          @unique
  valor        Decimal         @db.Decimal(10, 2)
  metodo       PagamentoMetodo @default(PIX)
  status       PagamentoStatus @default(PENDENTE)
  gatewayId    String?         @unique // id da cobrança no AbacatePay
  pixCopiaCola String?
  qrCodeUrl    String?
  expiraEm     DateTime?       // RN-13
  criadoEm     DateTime        @default(now())
  pagoEm       DateTime?

  @@index([status])
}

// ───────────── Apoio à gestão ─────────────
model Material {
  id                String   @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  nome              String
  quantidade        Int      @default(0)
  unidade           String?
  estoqueMinimo     Int?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([estabelecimentoId])
}

model Promocao {
  id                String       @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  codigo            String
  tipo              PromocaoTipo @default(PERCENTUAL)
  valor             Decimal      @db.Decimal(10, 2) // % ou R$ conforme tipo
  validadeInicio    DateTime
  validadeFim       DateTime
  usosMax           Int?
  usosFeitos        Int          @default(0)
  ativo             Boolean      @default(true)
  createdAt         DateTime     @default(now())

  reservas Reserva[]

  @@unique([estabelecimentoId, codigo])
  @@index([estabelecimentoId])
}

model Evento {
  id                String   @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  nome              String
  descricao         String?
  inicio            DateTime
  fim               DateTime
  vagas             Int?
  createdAt         DateTime @default(now())

  @@index([estabelecimentoId])
}

model Replay {
  id                String       @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  quadra            Quadra       @relation(fields: [quadraId], references: [id])
  quadraId          String
  reserva           Reserva?     @relation(fields: [reservaId], references: [id])
  reservaId         String?
  cliente           Usuario?     @relation("ReplayCliente", fields: [clienteId], references: [id])
  clienteId         String?
  s3Key             String
  url               String?
  duracaoSeg        Int?
  status            ReplayStatus @default(PROCESSANDO)
  expiraEm          DateTime?    // retenção (RN-17)
  criadoEm          DateTime     @default(now())

  @@index([estabelecimentoId])
  @@index([clienteId])
}

// Lista de espera (RN-11)
model WaitlistEntry {
  id          String    @id @default(cuid())
  quadra      Quadra    @relation(fields: [quadraId], references: [id], onDelete: Cascade)
  quadraId    String
  cliente     Usuario   @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  clienteId   String
  inicio      DateTime
  fim         DateTime
  notificadoEm DateTime?
  criadoEm    DateTime  @default(now())

  @@index([quadraId, inicio])
}

// Auditoria de ações sensíveis (RN-05)
model AuditLog {
  id                String   @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id])
  estabelecimentoId String
  autor             Usuario? @relation("AuditAutor", fields: [autorId], references: [id])
  autorId           String?
  acao              String   // "reserva.cancelar", "preco.alterar", ...
  entidade          String
  entidadeId        String?
  dados             Json?
  criadoEm          DateTime @default(now())

  @@index([estabelecimentoId, criadoEm])
}

// ───────────── Futuro (clubes) — descomentar quando entrar ─────────────
// model Jogador { id String @id @default(cuid()) /* ... */ }
// model Time    { id String @id @default(cuid()) /* ... */ }
// model Plano   { id String @id @default(cuid()) /* mensalidade */ }
// model Aula    { id String @id @default(cuid()) /* ... */ }
```

## Migração anti-overbooking (SQL — RN-01)
Após `prisma migrate dev`, adicionar uma migração manual:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reserva"
  ADD CONSTRAINT reserva_sem_sobreposicao
  EXCLUDE USING gist (
    "quadraId" WITH =,
    tsrange("inicio", "fim") WITH &&
  )
  WHERE (status <> 'CANCELADA');
```

## Seed de exemplo — `prisma/seed.ts`
```ts
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

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

  // Quadras (com preço de pico 18h–22h)
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
```
Registrar no `package.json` da API: `"prisma": { "seed": "tsx prisma/seed.ts" }` e rodar `pnpm prisma db seed`.

## Comandos
```bash
pnpm prisma migrate dev --name init   # cria o banco a partir do schema
pnpm prisma db seed                   # popula com os dados de exemplo
pnpm prisma studio                    # inspeciona os dados
```

> Conexões: [Arquitetura e Stack](arquitetura.md) (§15) · [Requisitos](requisitos.md) (RF/RN) · [ADR-0011 — Estratégia Multi-tenant](adr/0011-multi-tenant.md) · [Decisões de Arquitetura (ADRs)](adr/README.md) · [Estrutura do Monorepo](estrutura-monorepo.md).
