-- Mensalistas: serie recorrente que materializa reservas reais (ADR-0014, RF-35).
--
-- A ocorrencia de mensalista e uma `Reserva` comum, de modo que a restricao
-- `reserva_sem_sobreposicao` a protege como protege qualquer outra. Mensalista
-- virtual nao teria linha, e a restricao protege linha que existe.
--
-- O SQL foi gerado por `prisma migrate diff` entre o esquema anterior e o novo,
-- e nao escrito a mao.

-- CreateEnum
CREATE TYPE "RecorrenciaStatus" AS ENUM ('ATIVA', 'PAUSADA', 'ENCERRADA');

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "recorrenciaId" TEXT;

-- CreateTable
CREATE TABLE "Recorrencia" (
    "id" TEXT NOT NULL,
    "estabelecimentoId" TEXT NOT NULL,
    "quadraId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "duracaoMinutos" INTEGER NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "preco" DECIMAL(10,2) NOT NULL,
    "status" "RecorrenciaStatus" NOT NULL DEFAULT 'ATIVA',
    "materializadaAte" TIMESTAMP(3),
    "observacao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recorrencia_estabelecimentoId_status_idx" ON "Recorrencia"("estabelecimentoId", "status");

-- CreateIndex
CREATE INDEX "Recorrencia_quadraId_diaSemana_idx" ON "Recorrencia"("quadraId", "diaSemana");

-- CreateIndex
CREATE INDEX "Reserva_recorrenciaId_inicio_idx" ON "Reserva"("recorrenciaId", "inicio");

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "Recorrencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_estabelecimentoId_fkey" FOREIGN KEY ("estabelecimentoId") REFERENCES "Estabelecimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_quadraId_fkey" FOREIGN KEY ("quadraId") REFERENCES "Quadra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recorrencia" ADD CONSTRAINT "Recorrencia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

