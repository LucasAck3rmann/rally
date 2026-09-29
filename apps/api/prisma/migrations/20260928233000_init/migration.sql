-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENTE', 'ATENDENTE', 'FINANCEIRO', 'ADMIN', 'MANTENEDOR');

-- CreateEnum
CREATE TYPE "ModalidadeTipo" AS ENUM ('BEACH_TENNIS', 'FUTEVOLEI', 'VOLEI', 'OUTRO');

-- CreateEnum
CREATE TYPE "ReservaStatus" AS ENUM ('PENDENTE_PAGAMENTO', 'CONFIRMADA', 'CANCELADA', 'CONCLUIDA', 'NO_SHOW', 'BLOQUEIO');

-- CreateEnum
CREATE TYPE "ReservaOrigem" AS ENUM ('APP', 'WEB', 'BALCAO');

-- CreateEnum
CREATE TYPE "PagamentoMetodo" AS ENUM ('PIX', 'CARTAO');

-- CreateEnum
CREATE TYPE "PagamentoStatus" AS ENUM ('PENDENTE', 'PAGO', 'EXPIRADO', 'ESTORNADO', 'FALHOU');

-- CreateEnum
CREATE TYPE "PromocaoTipo" AS ENUM ('PERCENTUAL', 'VALOR_FIXO');

-- CreateEnum
CREATE TYPE "PlanoTipo" AS ENUM ('FREE', 'PRO', 'CLUBE');

-- CreateEnum
CREATE TYPE "ReplayStatus" AS ENUM ('PROCESSANDO', 'PRONTO', 'ERRO');

-- CreateTable
CREATE TABLE "Estabelecimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cnpj" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "nota" DECIMAL(2,1),
    "avaliacoes" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "plano" "PlanoTipo" NOT NULL DEFAULT 'FREE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "slotMinutos" INTEGER NOT NULL DEFAULT 60,
    "antecedenciaMinHoras" INTEGER NOT NULL DEFAULT 1,
    "antecedenciaMaxDias" INTEGER NOT NULL DEFAULT 30,
    "cancelamentoHoras" INTEGER NOT NULL DEFAULT 12,
    "descontoPixPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pixExpiraMinutos" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estabelecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioFuncionamento" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "abre" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,

    CONSTRAINT "HorarioFuncionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "telefone" TEXT,
    "avatarUrl" TEXT,
    "consentLgpdEm" TIMESTAMP(3),
    "anonimizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "canalWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "canalEmail" BOOLEAN NOT NULL DEFAULT true,
    "canalPush" BOOLEAN NOT NULL DEFAULT true,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modalidade" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "ModalidadeTipo" NOT NULL DEFAULT 'OUTRO',

    CONSTRAINT "Modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quadra" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "precoHora" DECIMAL(10,2) NOT NULL,
    "capacidade" INTEGER,
    "fotos" TEXT[],
    "comodidades" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quadra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaixaPreco" (
    "id" TEXT NOT NULL,
    "quadraId" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "precoHora" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "FaixaPreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "quadraId" TEXT NOT NULL,
    "clienteId" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "status" "ReservaStatus" NOT NULL DEFAULT 'PENDENTE_PAGAMENTO',
    "origem" "ReservaOrigem" NOT NULL DEFAULT 'APP',
    "preco" DECIMAL(10,2) NOT NULL,
    "promocaoId" TEXT,
    "canceladaEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "metodo" "PagamentoMetodo" NOT NULL DEFAULT 'PIX',
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "gatewayId" TEXT,
    "pixCopiaCola" TEXT,
    "qrCodeUrl" TEXT,
    "expiraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "unidade" TEXT,
    "estoqueMinimo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promocao" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "PromocaoTipo" NOT NULL DEFAULT 'PERCENTUAL',
    "valor" DECIMAL(10,2) NOT NULL,
    "validadeInicio" TIMESTAMP(3) NOT NULL,
    "validadeFim" TIMESTAMP(3) NOT NULL,
    "usosMax" INTEGER,
    "usosFeitos" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promocao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "vagas" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Replay" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "quadraId" TEXT NOT NULL,
    "reservaId" TEXT,
    "clienteId" TEXT,
    "s3Key" TEXT NOT NULL,
    "url" TEXT,
    "duracaoSeg" INTEGER,
    "status" "ReplayStatus" NOT NULL DEFAULT 'PROCESSANDO',
    "expiraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Replay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "quadraId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "notificadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "autorId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "dados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_QuadraModalidade" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_QuadraModalidade_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Estabelecimento_slug_key" ON "Estabelecimento"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HorarioFuncionamento_estabelecimentoId_diaSemana_key" ON "HorarioFuncionamento"("estabelecimentoId", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Account_usuarioId_idx" ON "Account"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_usuarioId_idx" ON "RefreshToken"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_usuarioId_key" ON "NotificationPreference"("usuarioId");

-- CreateIndex
CREATE INDEX "Membership_estabelecimentoId_idx" ON "Membership"("estabelecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_usuarioId_estabelecimentoId_key" ON "Membership"("usuarioId", "estabelecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Modalidade_nome_key" ON "Modalidade"("nome");

-- CreateIndex
CREATE INDEX "Quadra_estabelecimentoId_idx" ON "Quadra"("estabelecimentoId");

-- CreateIndex
CREATE INDEX "FaixaPreco_quadraId_idx" ON "FaixaPreco"("quadraId");

-- CreateIndex
CREATE INDEX "Reserva_estabelecimentoId_inicio_idx" ON "Reserva"("estabelecimentoId", "inicio");

-- CreateIndex
CREATE INDEX "Reserva_quadraId_inicio_fim_idx" ON "Reserva"("quadraId", "inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_quadraId_inicio_key" ON "Reserva"("quadraId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_reservaId_key" ON "Pagamento"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_gatewayId_key" ON "Pagamento"("gatewayId");

-- CreateIndex
CREATE INDEX "Pagamento_status_idx" ON "Pagamento"("status");

-- CreateIndex
CREATE INDEX "Material_estabelecimentoId_idx" ON "Material"("estabelecimentoId");

-- CreateIndex
CREATE INDEX "Promocao_estabelecimentoId_idx" ON "Promocao"("estabelecimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Promocao_estabelecimentoId_codigo_key" ON "Promocao"("estabelecimentoId", "codigo");

-- CreateIndex
CREATE INDEX "Evento_estabelecimentoId_idx" ON "Evento"("estabelecimentoId");

-- CreateIndex
CREATE INDEX "Replay_estabelecimentoId_idx" ON "Replay"("estabelecimentoId");

-- CreateIndex
CREATE INDEX "Replay_clienteId_idx" ON "Replay"("clienteId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_quadraId_inicio_idx" ON "WaitlistEntry"("quadraId", "inicio");

-- CreateIndex
CREATE INDEX "AuditLog_estabelecimentoId_criadoEm_idx" ON "AuditLog"("estabelecimentoId", "criadoEm");

-- CreateIndex
CREATE INDEX "_QuadraModalidade_B_index" ON "_QuadraModalidade"("B");

-- AddForeignKey
ALTER TABLE "HorarioFuncionamento" ADD CONSTRAINT "HorarioFuncionamento_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quadra" ADD CONSTRAINT "Quadra_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaixaPreco" ADD CONSTRAINT "FaixaPreco_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_promocaoId_fkey" FOREIGN KEY ("promocaoId") REFERENCES "Promocao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promocao" ADD CONSTRAINT "Promocao_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Replay" ADD CONSTRAINT "Replay_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuadraModalidade" ADD CONSTRAINT "_QuadraModalidade_A_fkey" FOREIGN KEY ("A") REFERENCES "Modalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuadraModalidade" ADD CONSTRAINT "_QuadraModalidade_B_fkey" FOREIGN KEY ("B") REFERENCES "Quadra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

