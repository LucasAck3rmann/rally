-- Verificacao de endereco de e-mail (RF-03).
--
-- Tabela separada da de senha, e nao uma coluna `tipo` na mesma: os dois
-- tokens tem validade diferente — trinta minutos contra sete dias — e
-- consequencias diferentes. Um troca credencial, o outro confirma um fato.
-- Juntar obrigaria toda consulta a filtrar por tipo, e um filtro esquecido
-- deixaria um token de verificacao redefinir senha.
--
-- `emailVerificadoEm` fica nulo para quem ja estava cadastrado. Isso e
-- correto e nao divida tecnica: ninguem provou controlar aquele endereco, e
-- marcar todo mundo como verificado na migracao seria inventar um fato.

ALTER TABLE "Usuario" ADD COLUMN "emailVerificadoEm" TIMESTAMP(3);

CREATE TABLE "TokenDeEmail" (
  "id"        TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiraEm"  TIMESTAMP(3) NOT NULL,
  "usadoEm"   TIMESTAMP(3),
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TokenDeEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenDeEmail_tokenHash_key" ON "TokenDeEmail"("tokenHash");
CREATE INDEX "TokenDeEmail_usuarioId_idx" ON "TokenDeEmail"("usuarioId");

ALTER TABLE "TokenDeEmail"
  ADD CONSTRAINT "TokenDeEmail_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
