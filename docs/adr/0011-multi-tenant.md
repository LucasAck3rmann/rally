# ADR-0011 — Estratégia de Multi-tenancy

**Status:** Aceito · **Data:** 2026-06-16 · **Decisores:** Lucas (tech lead)
**Relacionado:** [Modelo de Dados (schema.prisma)](../modelo-de-dados.md) · [Segurança, Privacidade e LGPD](../seguranca-lgpd.md) (RN-16) · [Decisões de Arquitetura (ADRs)](README.md)

## Contexto
O Rally é um **SaaS multi-tenant**: muitos estabelecimentos (quadras/arenas) compartilham a mesma aplicação, cada um com seus dados (quadras, reservas, clientes, financeiro). O isolamento entre tenants é um **requisito de segurança crítico** ([RN-16](Requisitos.md)): nenhum estabelecimento pode ver/alterar dado de outro, e um bug não pode virar vazamento (**IDOR**). Precisamos decidir **onde e como** esse isolamento é garantido, considerando que a stack usa **PostgreSQL + Prisma** (ADR-0004) com **connection pooling** e a meta de escalar para milhares de tenants pequenos.

### Forças/requisitos
- **Isolamento forte** (defesa em profundidade desejável) e baixo risco de erro humano.
- **Custo/operacional baixo** no início (muitos tenants pequenos — não compensa infra por tenant).
- **Compatibilidade com Prisma** (DX, migrations tipadas) e com pool de conexões.
- **Testabilidade** e simplicidade de evolução de schema.
- Caminho de **escala** sem reescrever tudo.

## Opções consideradas

### A) Banco compartilhado + schema compartilhado + **filtro na aplicação**
Uma coluna `estabelecimentoId` em cada tabela; toda query inclui o filtro, aplicado **de forma centralizada** (guard + camada de dados), nunca ad-hoc.
- **Prós:** simples; nativo no Prisma; migrations e testes triviais; custo mínimo; ótima DX.
- **Contras:** isolamento depende de **disciplina** — uma query sem o filtro = vazamento. Mitigável centralizando o escopo (ver Implementação) e com testes de autorização.

### B) Banco compartilhado + schema compartilhado + **RLS (Row-Level Security) do Postgres**
Políticas no banco (`CREATE POLICY ... USING (estabelecimento_id = current_setting('app.tenant')))`) forçam o isolamento **no servidor de dados**, independente da aplicação.
- **Prós:** **defesa em profundidade** — protege mesmo se a aplicação esquecer o filtro; padrão robusto.
- **Contras:** **fricção com Prisma + pool**: exige definir a variável de sessão (`SET LOCAL app.tenant`) **por requisição/transação** e garantir que a conexão do pool carregue esse contexto (transação dedicada ou `$extends`/middleware). Complica migrations, *seed*, testes e jobs que cruzam tenants (relatórios do mantenedor). Bypass do owner do banco exige cuidado.

### C) Banco compartilhado + **schema por tenant** (um `schema` Postgres por estabelecimento)
- **Prós:** isolamento lógico mais forte que coluna; backup/export por tenant.
- **Contras:** centenas/milhares de schemas não escalam bem; migrations precisam rodar em N schemas; Prisma não gerencia múltiplos schemas dinâmicos com naturalidade. Operacionalmente pesado.

### D) **Banco por tenant** (database/instância isolada)
- **Prós:** isolamento máximo; "ruído" e limites por tenant; exigido por alguns contratos enterprise.
- **Contras:** custo e operação **proibitivos** para muitos tenants pequenos; provisionamento, migrations e conexões multiplicados. Faz sentido só para **enterprise** específico.

## Decisão
Adotar **(A) banco e schema compartilhados com isolamento por `estabelecimentoId`**, aplicado de forma **centralizada e obrigatória** (não ad-hoc), como estratégia primária do MVP e do produto inicial. Planejar **(B) RLS como camada adicional de defesa em profundidade** antes de operar com muitos tenants reais — incremental, sem reescrever o modelo. Reservar **(C)/(D)** apenas para **clientes enterprise** que exijam isolamento físico, no futuro (open-core — ver [Código Aberto, Licença e Projeções](../codigo-aberto.md)).

> Resumo: **app-level scoping primeiro (pragmático e nativo no Prisma), RLS depois como rede de segurança; banco/Schema-por-tenant só no enterprise.**

## Consequências
**Positivas**
- Começa simples, barato e com ótima DX (Prisma puro), entregando o MVP/TCC no prazo.
- Caminho de endurecimento (RLS) já mapeado — vira só mais uma migração + wiring de sessão.
- Modelo de dados único: relatórios da plataforma (mantenedor) e evolução de schema são fáceis.

**Negativas / riscos & mitigação**
- *Risco:* uma consulta sem `estabelecimentoId` vaza dados (IDOR).
  - *Mitigação:* **escopo centralizado** (um único ponto que injeta o tenant — guard + extensão Prisma), **proibir** acesso ao Prisma cru fora da camada de dados (lint/review), e **testes de isolamento** no CI (tentar ler dado de outro tenant deve falhar).
- *Risco:* "vazamento" via relacionamentos/joins.
  - *Mitigação:* sempre partir da entidade `Estabelecimento`; revisão de queries que cruzam tabelas.
- *Risco:* ao adicionar RLS depois, custo de ajustar conexões/sessão.
  - *Mitigação:* já isolar o acesso a dados agora para o ponto de injeção de sessão ser único.

## Implementação (notas)
1. **Contexto de tenant por request (NestJS):** um `TenantGuard` resolve o `estabelecimentoId` (do token/rota) e o coloca num *request-scoped context* (`AsyncLocalStorage`).
2. **Escopo automático no Prisma:** uma extensão/`$extends` (ou middleware) injeta `where: { estabelecimentoId }` nas operações dos modelos tenant-scoped — desenvolvedor não repete o filtro à mão.
3. **Proibir bypass:** acesso ao `PrismaClient` só via repositórios; ESLint/review barram query crua em controllers.
4. **Testes de isolamento (CI):** suíte que cria 2 tenants e garante que A nunca lê/escreve em B (RNF-06).
5. **Caminho RLS (futuro):** habilitar `ROW LEVEL SECURITY` nas tabelas, `CREATE POLICY tenant_isolation USING (estabelecimento_id = current_setting('app.tenant')::text)`, e abrir cada transação com `SET LOCAL app.tenant = $id`. Conta de aplicação **sem** `BYPASSRLS`; jobs cross-tenant usam conta separada e explícita.
6. **Mantenedor/SaaS-admin:** acessos cross-tenant (métricas da plataforma) passam por um caminho **explícito e auditado** ([AuditLog](Modelo%20de%20Dados%20(schema.prisma).md)), nunca pelo escopo padrão.

## Revisão
Revisar quando: (a) o 1º cliente **enterprise** exigir isolamento físico → avaliar (D) para ele; (b) volume/tenant justificar RLS obrigatório → promover (B) a primário. Um novo ADR substituirá este se a estratégia primária mudar.
