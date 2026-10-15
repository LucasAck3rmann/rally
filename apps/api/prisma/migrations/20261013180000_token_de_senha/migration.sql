-- Token de redefinicao de senha (RF-03).
--
-- Guarda o hash e nunca o token, pelo mesmo motivo de `senhaHash`: quem
-- lesse o banco poderia redefinir a senha de qualquer pessoa. O hash e
-- sha256 e nao argon2 porque aqui o segredo tem entropia completa — ele e
-- gerado por `randomBytes`, nao escolhido por uma pessoa —, e argon2 existe
-- para encarecer a forca bruta contra segredo fraco.
--
-- `tokenHash` e unico: o indice serve a busca (e o unico jeito de achar o
-- token, ja que o valor original nao esta guardado) e impede colisao.
--
-- `usadoEm` marca o uso em vez de apagar a linha. Apagar deixaria "token
-- invalido" e "token ja usado" indistinguiveis, e as duas situacoes levam a
-- orientacoes diferentes para quem clicou.

CREATE TABLE "TokenDeSenha" (
  "id"        TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiraEm"  TIMESTAMP(3) NOT NULL,
  "usadoEm"   TIMESTAMP(3),
  "criadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TokenDeSenha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenDeSenha_tokenHash_key" ON "TokenDeSenha"("tokenHash");
CREATE INDEX "TokenDeSenha_usuarioId_idx" ON "TokenDeSenha"("usuarioId");

ALTER TABLE "TokenDeSenha"
  ADD CONSTRAINT "TokenDeSenha_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
