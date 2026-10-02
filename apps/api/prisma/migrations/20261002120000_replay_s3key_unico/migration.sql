-- Idempotência da ingestão de replay (RF-30).
--
-- O provedor de captação reentrega o mesmo clipe quando não recebe 2xx — é o
-- comportamento normal de um webhook. Sem trava, duas entregas simultâneas
-- criariam dois `Replay` do mesmo vídeo: a checagem "já existe?" na aplicação
-- tem uma janela entre o SELECT e o INSERT, e é exatamente nela que a segunda
-- tentativa cabe.
--
-- A garantia mora no banco, pelo mesmo motivo da `reserva_sem_sobreposicao`:
-- quem decide é o armazenamento, não a ordem em que as requisições chegam.
CREATE UNIQUE INDEX "Replay_s3Key_key" ON "Replay"("s3Key");

-- A ingestão procura o clipe pela quadra e pela janela de tempo; sem este
-- índice a busca varre a tabela a cada entrega.
CREATE INDEX "Replay_quadraId_criadoEm_idx" ON "Replay"("quadraId", "criadoEm");

-- O instante do lance: é por ele que o clipe acha a reserva e, por ela, o
-- cliente. Anulável porque clipe antigo (do seed) não tem essa informação.
ALTER TABLE "Replay" ADD COLUMN "gravadoEm" TIMESTAMP(3);
