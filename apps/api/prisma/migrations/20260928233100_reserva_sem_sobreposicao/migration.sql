-- Anti-overbooking de verdade, no banco (RN-01).
--
-- O índice único (quadraId, inicio) que o schema gera protege pouco e atrapalha
-- muito, porque cobre só o início exato e vale para TODAS as linhas — inclusive
-- as canceladas. Isso deixava dois furos:
--
--   1. Sobreposição parcial passava batido: 19:00–20:00 e 19:30–20:30 têm
--      inícios diferentes, então o índice não via conflito nenhum.
--   2. Depois de um cancelamento, aquele horário não podia ser reservado nunca
--      mais. A linha cancelada seguia ocupando a chave única, e a criação da
--      nova reserva morria com violação de unicidade — embora a grade de
--      disponibilidade já mostrasse o horário como livre.
--
-- A exclusion constraint resolve os dois de uma vez: compara os intervalos com
-- o operador de sobreposição (&&) e ignora o que está cancelado. O `tsrange`
-- usa limites [início, fim), então 19:00–20:00 e 20:00–21:00 continuam podendo
-- coexistir, que é o comportamento de uma grade de slots encostados.
--
-- `btree_gist` é o que permite misturar a igualdade de "quadraId" (texto) com o
-- operador de intervalo no mesmo índice GiST.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DROP INDEX IF EXISTS "Reserva_quadraId_inicio_key";

ALTER TABLE "Reserva"
  ADD CONSTRAINT reserva_sem_sobreposicao
  EXCLUDE USING gist (
    "quadraId" WITH =,
    tsrange("inicio", "fim") WITH &&
  )
  WHERE (status <> 'CANCELADA');
