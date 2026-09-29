# Migrations (Prisma)

As migrações são geradas a partir de `../schema.prisma` com:
```bash
pnpm prisma migrate dev --name <descrição>
```

Sem um banco à mão, dá para gerar o SQL a partir do schema com
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`.

## Migrações

| Migração | O que faz |
|---|---|
| `20260928233000_init` | Linha de base: todo o schema (enums, tabelas, índices e chaves). |
| `20260928233100_reserva_sem_sobreposicao` | Anti-overbooking de verdade (RN-01) — ver abaixo. |

## Anti-overbooking (RN-01) — aplicado

A `EXCLUDE USING gist` substitui o índice único `(quadraId, inicio)`, que
protegia pouco e atrapalhava muito:

- **Sobreposição parcial passava batido.** 19:00–20:00 e 19:30–20:30 têm
  inícios diferentes, então o índice não via conflito — e a quadra terminava
  com dois jogos ao mesmo tempo.
- **Horário cancelado ficava preso para sempre.** O índice valia para todas as
  linhas, inclusive as canceladas, então reservar de novo aquele horário
  falhava por violação de unicidade, mesmo com a grade mostrando-o livre.

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

O `tsrange` usa limites `[início, fim)`, então slots encostados (19:00–20:00 e
20:00–21:00) continuam convivendo — que é como uma grade de horários funciona.

O comportamento está coberto por
`src/modules/reservas/reserva-sem-sobreposicao.integracao.spec.ts`, que só roda
quando há `DATABASE_URL`. A CI levanta um Postgres, aplica as migrações e roda
esses testes no job **Migrações e concorrência**.

Contexto em `docs/modelo-de-dados.md` e na decisão de multi-tenancy
`docs/adr/0011-multi-tenant.md`.
