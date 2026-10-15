-- Limite de usos do cupom garantido pelo banco (RN-14).
--
-- O serviço confere `usosFeitos < usosMax` antes de criar a reserva, mas essa
-- conferência serve para **responder rápido e explicar o motivo** ao cliente —
-- ela não garante nada. Entre ler o contador e gravar a reserva cabe outra
-- requisição fazendo exatamente o mesmo: as duas leem 49 de 50, as duas
-- passam, e o cupom de cinquenta usos sai cinquenta e um.
--
-- É o mesmo raciocínio da `reserva_sem_sobreposicao`: a regra que não pode ser
-- furada mora no banco, onde vale para qualquer caminho de escrita — inclusive
-- um script de migração de dados ou um `psql` aberto às pressas.
--
-- Com a restrição, o incremento dentro da transação da reserva estoura e
-- derruba a transação inteira, então não existe reserva criada com um uso de
-- cupom que não foi contabilizado, nem contador adiantado sem reserva.
--
-- `usosMax` nulo significa "sem limite", e aí a restrição não se aplica.

ALTER TABLE "Estabelecimento"
  ADD COLUMN "cuponsAcumulam" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Promocao"
  ADD CONSTRAINT promocao_usos_dentro_do_limite
  CHECK ("usosMax" IS NULL OR "usosFeitos" <= "usosMax");
