# Migrations (Prisma)

As migrações são geradas a partir de `../schema.prisma` com:
```bash
pnpm prisma migrate dev --name <descrição>
```

## Migração manual obrigatória — anti-overbooking (RN-01)
Depois da migração inicial, adicionar uma migração com a **exclusion constraint** do
PostgreSQL, que impede **no banco** (não só na aplicação) duas reservas ativas no mesmo
intervalo/quadra:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reserva"
  ADD CONSTRAINT reserva_sem_sobreposicao
  EXCLUDE USING gist (
    "quadraId" WITH =,
    tsrange("inicio", "fim") WITH &&
  )
  WHERE (status <> 'CANCELADA');
```

Contexto em `docs/modelo-de-dados.md` (raiz do repo) e na decisão de multi-tenancy
`docs/adr/0011-multi-tenant.md`.
