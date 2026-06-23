# Governança e Gestão — Tecnologia, Design, Código e Estrutura

> Como o Rally é **conduzido**: como decisões são tomadas, como a tecnologia é gerida, como design e código mantêm padrão, e como o trabalho/estrutura são organizados. Complementa a parte "o que/por quê" ([Arquitetura e Stack](arquitetura.md), [Fundamentação Teórica e Padrões](fundamentacao.md)) com o "**como governar**". Para 1 dev hoje (Lucas) e escalável para time.

## 1. Governança de decisões
| Tipo de decisão | Instrumento | Onde |
|---|---|---|
| Arquitetura / stack / tech | **ADR** (contexto→decisão→consequências) | `docs/adr/` · [Decisões de Arquitetura (ADRs)](adr/README.md) |
| Mudança grande de produto/processo | **RFC** (proposta discutida antes de codar) | `docs/rfc/` ou issue "RFC:" |
| Mudança pequena | **PR** com descrição do "porquê" | GitHub |
- **Quem decide:** hoje o *tech lead* (Lucas); com time, decisão por **consenso no PR/ADR** e desempate do owner da área (CODEOWNERS).
- **Regra de ouro:** decisão relevante **não vive só na cabeça** — vira ADR/RFC. ADR aceito não se reescreve; cria-se outro que o **substitui**.

## 2. Gestão de tecnologia — Tech Radar
| Anel | Tecnologias |
|---|---|
| **Adopt** (usar) | TypeScript · Next.js · NestJS · Flutter · PostgreSQL · Prisma · Redis/BullMQ · Tailwind · Zod · Docker · AWS · Terraform · GitHub Actions · Conventional Commits |
| **Trial** (provar em escopo controlado) | SST/OpenNext · MediaConvert/IVS · OpenTelemetry · Playwright · AbacatePay |
| **Assess** (estudar p/ o futuro) | EKS · Kafka/Kinesis · OpenSearch · Aurora · ML de highlights |
| **Hold** (evitar/não adotar) | React Native · MongoDB · `Float` p/ dinheiro · deploy manual · segredo em código |

**Política de adoção de nova lib/tech** — só entra se passar em: resolve um requisito real · manutenção ativa · licença compatível ([Código Aberto, Licença e Projeções](codigo-aberto.md)) · não duplica algo que já temos · cabe no orçamento. Acima de "pequena", exige ADR.
**Atualizações/versões:** **Renovate/Dependabot** abrem PRs; **SemVer** com ranges `^`; rodar em Node **LTS (22)**; atualização de major → ADR/teste. Segurança crítica entra fora de cadência.
**Remoção:** tech em *Hold* tem plano de saída; nada de duas libs para a mesma função sem ADR de transição.

## 3. Governança de design
- **Fonte única de verdade:** tokens no **Figma → Style Dictionary → Tailwind/Flutter**. Nada de hex solto; nada de fonte fora de Sora/Inter/Space Mono. Base: skill `rally-design-system` + [DESIGN.md (raiz do repo)](../DESIGN.md).
- **Design review:** toda tela nova passa pelo checklist do design system **antes** do merge.
- **Contribuição de componente:** novo componente entra em `packages/ui` (web) com variantes e estados; reaproveitar antes de criar.
- **Acessibilidade é gate, não opinião:** WCAG AA obrigatório (contraste, teclado, foco, alvos ≥ 44px) — PR de UI que falha **não** entra.
- **DoD de UI:** responsivo (mobile→desktop), estados (vazio/carregando/erro), tokens aplicados, a11y conferida.

## 4. Governança de programação (código)
**Definition of Ready (entrar no sprint):** problema claro · critérios de aceite · dependências conhecidas · cabe numa branch curta.
**Definition of Done (fechar):** código + **testes** · `lint`/`typecheck`/`test`/`build` verdes · revisado · docs/ADR atualizados · sem segredo/`TODO` solto · atende RNF aplicável.
- **Padrões de código:** ver [Fundamentação Teórica e Padrões](fundamentacao.md) (SOLID, clean code, padrões). ESLint + Prettier + `dart analyze` automáticos.
- **Code review:** PR **pequeno** (< ~400 linhas idealmente); pelo menos 1 aprovação (CODEOWNERS); SLA de review ~1 dia útil; revisar **lógica, segurança, testes e clareza** — não estilo (isso é do linter).
- **Testes:** pirâmide (muito unitário, algum integração, pouco e2e); **cobertura ≥ 70%** no core (RNF-13); todo bug vira teste de regressão.
- **Branch protection (`main`):** PR obrigatório · CI verde · review aprovado · sem push direto · histórico linear (squash + Conventional Commit no merge).

## 5. Estrutura e ownership
- **Estrutura do repo:** [Estrutura do Monorepo](estrutura-monorepo.md) (Turborepo). Fronteiras explícitas entre `apps/*` e `packages/*` — `web`/`mobile` consomem contratos de `packages/shared`, nunca o inverso.
- **Ownership:** `CODEOWNERS` por área ([.github/CODEOWNERS](../.github/CODEOWNERS)); cada módulo NestJS tem dono lógico.
- **Ambientes:** `dev` (Docker local) → `staging` (pré-produção AWS) → `production`. Config por ambiente (12-Factor); **feature flags** para soltar incompleto sem quebrar.

## 6. Versionamento e releases
- **SemVer** (`major.minor.patch`) · **changesets** geram `CHANGELOG.md` · tags `vX.Y.Z`.
- **Cadência:** release ao acumular mudanças relevantes em `main`; **hotfix** = patch direto + cherry-pick.
- **Releases públicas** (quando OSS): notas de release + destaque de breaking changes + crédito a contribuidores.

## 7. Gestão de segredos e acessos
- **Segredos:** `.env` (dev, fora do Git) → **AWS Secrets Manager / SSM** (staging/prod). **Nunca** em código/PR. Rotação periódica.
- **Acessos (least privilege):** IAM por serviço/pessoa; MFA nas contas AWS/GitHub; revisão de acessos a cada mudança de time.
- **Chaves de terceiros** (AbacatePay, WhatsApp, Meta, FCM) versionadas só como referência em `.env.example` (sem valor).

## 8. Gestão do trabalho (processo)
- **Kanban** (GitHub Projects): `Backlog → Ready → Doing → Review → Done`; issues etiquetadas e ligadas às fases do Roadmap.
- **Milestones** por fase (MVP/TCC primeiro). **Labels:** `area:*`, `tipo:*`, `prio:*`, `good first issue`.
- **Triagem** semanal do backlog; **roadmap público** quando o repo abrir.
- Para o **TCC**: entregas incrementais, cada uma demonstrável; cronograma amarrado às fases.

## 9. Saúde e métricas (governança de qualidade)
- **Entrega (DORA-lite):** lead time de PR, frequência de deploy, taxa de falha de mudança, MTTR.
- **Qualidade:** cobertura de testes, nº de bugs abertos, vulnerabilidades (CodeQL/Dependabot) zeradas em sev. alta.
- **Produto/RNF:** p95 de latência, uptime, Core Web Vitals — alvos em [Requisitos](requisitos.md) (RNF), medidos por CloudWatch/Sentry.

## 10. Papéis (RACI-lite, hoje e ao crescer)
| Área | Responsável (hoje) | Ao crescer |
|---|---|---|
| Produto/decisão | Lucas | PO + tech lead |
| Back-end/infra | Lucas | dev back + DevOps |
| Front/web + mobile | Lucas | dev front + mobile |
| Design system | Lucas (+ skill) | designer |
| Segurança/LGPD | Lucas | encarregado (DPO) — ver [Segurança, Privacidade e LGPD](seguranca-lgpd.md) |

> Conexões: [Arquitetura e Stack](arquitetura.md) · [Fundamentação Teórica e Padrões](fundamentacao.md) · [Decisões de Arquitetura (ADRs)](adr/README.md) · [Estrutura do Monorepo](estrutura-monorepo.md) · [Código Aberto, Licença e Projeções](codigo-aberto.md) · [Requisitos](requisitos.md).
