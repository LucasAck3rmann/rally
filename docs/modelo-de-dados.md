# Modelo de Dados — `schema.prisma` (v3) + migrações + seed

> **Espelho do schema real.** A fonte de verdade é `apps/api/prisma/schema.prisma`; este documento reproduz o que está lá e explica **por que** está assim. Sincronizado em **29/09/2026** (`main`). Ao mudar o modelo, mude o schema primeiro e traga a mudança para cá no mesmo *pull request* — foi por não fazer isso que este arquivo passou a descrever uma trava anti-overbooking que já não existia.
>
> São **19 entidades e 10 enumerações**, multi-tenant por `estabelecimentoId` (estratégia em [ADR-0011 — Estratégia Multi-tenant](adr/0011-multi-tenant.md)). Entidades do [§15 de Arquitetura](arquitetura.md); regras de negócio em [Requisitos](requisitos.md) §5; ORM escolhido no [ADR-0004](adr/README.md).

## Decisões de modelagem

- **Multi-tenancy:** tudo pendura em **`Estabelecimento`** (o *tenant*); papéis em **`Membership`** (Usuario × Estabelecimento × Role). O papel é lido do vínculo, nunca do token.
- **Dinheiro:** `Decimal` — nunca `Float`. Ponto flutuante tem erro de representação em base 2, e dinheiro exige exatidão decimal. **IDs:** `cuid()`. **Horas de funcionamento:** `"HH:mm"` em texto + `timezone` do estabelecimento.
- **Config por estabelecimento:** slot, antecedência, janela de cancelamento, desconto Pix e expiração do Pix são **dados, não código** — RN-02/03/07/08/13. É o que permite mudar a regra de um cliente sem *deploy*.
- **Anti-overbooking (RN-01):** a trava é a *exclusion constraint* **`reserva_sem_sobreposicao`**, aplicada por migração. **Não há `@@unique([quadraId, inicio])`** — ele foi removido por proteger pouco e atrapalhar muito (ver a seção de migrações).
- **Notificação (RF-16):** `Notificacao` é o aviso in-app já emitido; `NotificationPreference` é a preferência de canal, que existe desde junho e ainda não tem canal externo para preferir.
- **LGPD/auditoria:** `AuditLog` para ações sensíveis (RN-05) — a entidade existe e **ainda não é escrita**; consentimento no `Usuario`; exclusão anonimiza em vez de apagar, preservando o registro financeiro que a lei exige manter (RN-18).

## `schema.prisma`

```prisma
// Rally — schema de dados (PostgreSQL + Prisma)
// SPDX-License-Identifier: AGPL-3.0-or-later
// Multi-tenant por estabelecimentoId (ver docs/adr/0011-multi-tenant.md).

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────── Enums ─────────────
enum Role {
  CLIENTE
  ATENDENTE
  FINANCEIRO
  ADMIN
  MANTENEDOR
}

enum ModalidadeTipo {
  BEACH_TENNIS
  FUTEVOLEI
  VOLEI
  OUTRO
}

enum ReservaStatus {
  PENDENTE_PAGAMENTO
  CONFIRMADA
  CANCELADA
  CONCLUIDA
  NO_SHOW
  BLOQUEIO
}

enum ReservaOrigem {
  APP
  WEB
  BALCAO
}

enum PagamentoMetodo {
  PIX
  CARTAO
}

enum PagamentoStatus {
  PENDENTE
  PAGO
  EXPIRADO
  ESTORNADO
  FALHOU
}

enum PromocaoTipo {
  PERCENTUAL
  VALOR_FIXO
}

enum PlanoTipo {
  FREE
  PRO
  CLUBE
}

enum ReplayStatus {
  PROCESSANDO
  PRONTO
  ERRO
}

// ───────────── Núcleo / tenant ─────────────
model Estabelecimento {
  id                   String    @id @default(cuid())
  nome                 String
  slug                 String    @unique
  cnpj                 String?
  bairro               String?
  cidade               String?
  uf                   String?
  nota                 Decimal?  @db.Decimal(2, 1)
  avaliacoes           Int       @default(0)
  timezone             String    @default("America/Sao_Paulo")
  plano                PlanoTipo @default(FREE)
  ativo                Boolean   @default(true)
  slotMinutos          Int       @default(60)
  antecedenciaMinHoras Int       @default(1)
  antecedenciaMaxDias  Int       @default(30)
  cancelamentoHoras    Int       @default(12)
  descontoPixPct       Decimal   @default(0) @db.Decimal(5, 2)
  pixExpiraMinutos     Int       @default(30)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  quadras   Quadra[]
  membros   Membership[]
  horarios  HorarioFuncionamento[]
  reservas  Reserva[]
  materiais Material[]
  promocoes Promocao[]
  eventos   Evento[]
  replays   Replay[]
  auditLogs AuditLog[]
}

model HorarioFuncionamento {
  id                String  @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id], onDelete: Cascade)
  estabelecimentoId String
  diaSemana         Int
  abre              String
  fecha             String

  @@unique([estabelecimentoId, diaSemana])
}

model Usuario {
  id            String    @id @default(cuid())
  nome          String
  email         String    @unique
  senhaHash     String?
  telefone      String?
  avatarUrl     String?
  consentLgpdEm DateTime?
  anonimizadoEm DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  memberships   Membership[]
  reservas      Reserva[]               @relation("ReservaCliente")
  replays       Replay[]                @relation("ReplayCliente")
  accounts      Account[]
  refreshTokens RefreshToken[]
  notifPref     NotificationPreference?
  notificacoes  Notificacao[]
  waitlist      WaitlistEntry[]
  auditLogs     AuditLog[]              @relation("AuditAutor")
}

model Account {
  id                String  @id @default(cuid())
  usuario           Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId         String
  provider          String
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

/// Tipos que a tela de Notificações agrupa (ver Telas e Fluxos).
enum NotificacaoTipo {
  RESERVA
  PAGAMENTO
  REPLAY
  PROMOCAO
  LEMBRETE
}

/// Aviso in-app (RF-16). O e-mail é outro canal e ainda não existe.
model Notificacao {
  id        String          @id @default(cuid())
  usuario   Usuario         @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId String
  tipo      NotificacaoTipo
  titulo    String
  corpo     String

  /// Rota do app que o toque abre, ex.: "/reservas/abc/confirmacao".
  destino   String?
  lidaEm    DateTime?
  createdAt DateTime        @default(now())

  @@index([usuarioId, createdAt])
}

model NotificationPreference {
  id             String  @id @default(cuid())
  usuario        Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  usuarioId      String  @unique
  canalWhatsapp  Boolean @default(true)
  canalEmail     Boolean @default(true)
  canalPush      Boolean @default(true)
  marketingOptIn Boolean @default(false)
}

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
  precoHora         Decimal  @db.Decimal(10, 2)
  capacidade        Int?
  fotos             String[]
  comodidades       String[]
  ativo             Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  modalidades Modalidade[]    @relation("QuadraModalidade")
  faixasPreco FaixaPreco[]
  reservas    Reserva[]
  replays     Replay[]
  waitlist    WaitlistEntry[]

  @@index([estabelecimentoId])
}

model FaixaPreco {
  id         String  @id @default(cuid())
  quadra     Quadra  @relation(fields: [quadraId], references: [id], onDelete: Cascade)
  quadraId   String
  diaSemana  Int?
  horaInicio String
  horaFim    String
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
  clienteId          String?
  inicio             DateTime
  fim                DateTime
  status             ReservaStatus @default(PENDENTE_PAGAMENTO)
  origem             ReservaOrigem @default(APP)
  preco              Decimal       @db.Decimal(10, 2)
  promocao           Promocao?     @relation(fields: [promocaoId], references: [id])
  promocaoId         String?
  canceladaEm        DateTime?
  motivoCancelamento String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  pagamento Pagamento?
  replays   Replay[]

  // Sem índice único aqui: a trava contra overbooking é a exclusion constraint
  // `reserva_sem_sobreposicao` (ver migrations). Ela cobre sobreposição parcial
  // e ignora reservas canceladas — um único (quadraId, inicio) faria o oposto:
  // deixava passar 19:30 sobre 19:00 e prendia para sempre um horário cancelado.
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
  gatewayId    String?         @unique
  pixCopiaCola String?
  qrCodeUrl    String?
  expiraEm     DateTime?
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
  valor             Decimal      @db.Decimal(10, 2)
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
  expiraEm          DateTime?
  criadoEm          DateTime     @default(now())

  @@index([estabelecimentoId])
  @@index([clienteId])
}

model WaitlistEntry {
  id           String    @id @default(cuid())
  quadra       Quadra    @relation(fields: [quadraId], references: [id], onDelete: Cascade)
  quadraId     String
  cliente      Usuario   @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  clienteId    String
  inicio       DateTime
  fim          DateTime
  notificadoEm DateTime?
  criadoEm     DateTime  @default(now())

  @@index([quadraId, inicio])
}

model AuditLog {
  id                String   @id @default(cuid())
  estabelecimento   Estabelecimento @relation(fields: [estabelecimentoId], references: [id])
  estabelecimentoId String
  autor             Usuario? @relation("AuditAutor", fields: [autorId], references: [id])
  autorId           String?
  acao              String
  entidade          String
  entidadeId        String?
  dados             Json?
  criadoEm          DateTime @default(now())

  @@index([estabelecimentoId, criadoEm])
}

// ───────────── Futuro (clubes) — descomentar quando entrar ─────────────
// model Jogador { id String @id @default(cuid()) }
// model Time    { id String @id @default(cuid()) }
// model Plano   { id String @id @default(cuid()) }
// model Aula    { id String @id @default(cuid()) }
```

## Migrações

Em `apps/api/prisma/migrations/`, aplicadas e verificadas contra PostgreSQL real na CI (job "Migrações e concorrência"):

| Migração | O que faz |
|---|---|
| `20260928233000_init` | Linha de base, gerada com `prisma migrate diff --from-empty` (dispensa banco rodando) |
| `20260928233100_reserva_sem_sobreposicao` | Troca o índice único pela *exclusion constraint* — ver abaixo |
| `20260929170713_notificacoes` | `Notificacao` e `NotificacaoTipo` (RF-16) |

### Anti-overbooking (RN-01) — por que deixou de ser índice único

O índice único `(quadraId, inicio)` que o schema gerava protegia pouco e atrapalhava muito, porque cobre só o **instante** de início, não o **intervalo**, e vale para **todas** as linhas — inclusive as canceladas. Dois furos:

1. **Sobreposição parcial passava batido:** 19:00–20:00 e 19:30–20:30 têm inícios diferentes, então o índice não via conflito nenhum e o overbooking acontecia.
2. **O horário cancelado ficava preso para sempre:** a linha cancelada seguia ocupando a chave única, e a criação da nova reserva morria com violação de unicidade — enquanto a grade de disponibilidade já mostrava o horário como livre. O cancelamento (RF-09) tornou esse caminho comum, não teórico.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP INDEX IF EXISTS "Reserva_quadraId_inicio_key";

ALTER TABLE "Reserva"
  ADD CONSTRAINT reserva_sem_sobreposicao
  EXCLUDE USING gist (
    "quadraId" WITH =,
    tsrange("inicio", "fim") WITH &&
  )
  WHERE (status <> 'CANCELADA');
```

- **`btree_gist`** é o que permite misturar a *igualdade* de `quadraId` (texto) com o operador de intervalo no mesmo índice GiST.
- **`tsrange` usa limites `[início, fim)`** — fechado à esquerda, aberto à direita. É isso que deixa 19:00–20:00 e 20:00–21:00 coexistirem, comportamento esperado de uma grade de slots encostados. Com limites fechados dos dois lados, a grade inteira travaria.
- **`WHERE (status <> 'CANCELADA')`** devolve o horário ao mercado depois de um cancelamento.

**Do lado da aplicação:** a violação deixa de ser `P2002` e passa a ser **`23P01`** (`exclusion_violation`), que o Prisma ainda não mapeia para um código próprio — chega como `PrismaClientUnknownRequestError`, sem `code`, com o nome da restrição na mensagem. Por isso `ehConflitoDeHorario` em `reservas.service.ts` reconhece os dois formatos; o `P2002` fica de propósito, para bancos que ainda não receberam a migração. A colisão vira **HTTP 409**, não overbooking.

## Seed — `apps/api/prisma/seed.ts`

Idempotente (pode rodar quantas vezes quiser) e desenhado para reproduzir os dados das telas do Figma, de modo que o app suba com conteúdo real:

- **Modalidades:** Beach Tennis, Futevôlei e Vôlei.
- **Dois estabelecimentos:** *Arena Beach Sapiranga* e *Vila do Vôlei*, com horário de funcionamento, quadras, fotos, comodidades e faixas de preço de pico.
- **Dois usuários:** um dono (com `Membership` de `ADMIN`) e um cliente. Senha de desenvolvimento igual para os dois.
- **Promoção** do card da Home e **replays** do cliente para a tela de Replays.

Os dados são **fictícios** — nenhum dado pessoal real é tratado em desenvolvimento.

## Comandos

```bash
pnpm --filter @rally/api exec prisma migrate deploy   # aplica as migrações existentes
pnpm --filter @rally/api exec prisma migrate dev      # cria migração a partir do schema
pnpm --filter @rally/api db:seed                      # popula com os dados de exemplo
pnpm --filter @rally/api exec prisma studio           # inspeciona os dados
```

> Conexões: [Arquitetura e Stack](arquitetura.md) (§15) · [Requisitos](requisitos.md) (RF/RN) · [ADR-0011 — Estratégia Multi-tenant](adr/0011-multi-tenant.md) · [Decisões de Arquitetura (ADRs)](adr/README.md) · [Estrutura do Monorepo](estrutura-monorepo.md).
