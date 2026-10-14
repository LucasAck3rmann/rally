-- Lembrete antes do jogo (RF-17).
--
-- A coluna marca que o aviso ja saiu, e e o que torna o envio idempotente:
-- o job roda de dez em dez minutos e a janela do lembrete dura horas, entao
-- sem ela a mesma reserva receberia dezenas de avisos.
--
-- Marcar no banco, e nao guardar em memoria: o processo reinicia, e um
-- controle que nao sobrevive ao reinicio avisa tudo de novo na volta.
--
-- Indice parcial sobre as que ainda nao receberam: o job pergunta sempre
-- "quais faltam", e essa pergunta fica cara quando a tabela cresce se o
-- banco tiver de varrer tambem as milhares que ja foram avisadas. As linhas
-- entram no indice ao nascer e saem dele quando o aviso sai, entao ele nao
-- cresce com o historico.

ALTER TABLE "Reserva" ADD COLUMN "lembreteEnviadoEm" TIMESTAMP(3);

CREATE INDEX "Reserva_lembrete_pendente_idx"
  ON "Reserva" ("inicio")
  WHERE "lembreteEnviadoEm" IS NULL;
