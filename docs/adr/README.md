# Decisões de Arquitetura (ADRs)

> **ADR = Architecture Decision Record.** Cada decisão relevante é registrada com *contexto → decisão → alternativas → consequências*, para que a escolha seja **rastreável** (e defensável na banca). No repositório, vira um arquivo por ADR em `docs/adr/NNNN-*.md`. Resumo da stack em [Arquitetura e Stack](../arquitetura.md).

**Status possíveis:** Proposto · **Aceito** · Substituído · Depreciado.

---

## ADR-0001 — NestJS como framework de back-end
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Precisamos de uma API robusta, testável e organizada por domínio, com TypeScript, para servir web e mobile.
**Decisão:** Usar **NestJS** (Node + TS) com arquitetura modular (controller→service→repository), DI nativa e OpenAPI.
**Alternativas:** Next.js API routes (acoplaria back ao front, sem estrutura); Express/Fastify puro (flexível, mas sem padrão imposto — vira bagunça); Django/Spring (fora do ecossistema TS do monorepo).
**Consequências:** (+) modularidade, testabilidade, DI, documentação Swagger, padrão de mercado. (−) curva de aprendizado e verbosidade (decorators/DTOs) — aceitável pelo ganho de organização.

## ADR-0002 — Flutter no aplicativo mobile
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Queremos **um app nativo** para iOS e Android com uma base de código, boa performance e UI fiel ao design system.
**Decisão:** **Flutter (Dart 3)** com Riverpod, go_router e Dio (clean architecture).
**Alternativas:** React Native (compartilharia TS/React com a web, mas com mais fricção nativa e fragmentação de libs); PWA (não atende câmera de replay/push nativo a contento); nativo duplo Kotlin+Swift (custo 2×).
**Consequências:** (+) UI consistente, performance, 1 base p/ 2 plataformas, ótimo p/ recursos de câmera (replays). (−) Dart fora do stack TS (mas tokens vêm do mesmo Style Dictionary); time precisa aprender Dart.

## ADR-0003 — AbacatePay como gateway de pagamento
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O público é brasileiro e o **Pix** é o meio dominante; precisamos de cobrança simples com webhook confiável.
**Decisão:** **AbacatePay** como gateway principal (Pix + cartão), confirmação por **webhook assinado** e idempotência.
**Alternativas:** Stripe (excelente DX, mas Pix limitado e foco internacional); Mercado Pago/Asaas/Pagar.me (válidos — ficam como fallback). 
**Consequências:** (+) Pix nativo BR, simplicidade, custo. (−) menos maduro que Stripe e menos material — mitigado por isolar o gateway atrás de um **Adapter** (troca sem mexer no domínio).

## ADR-0004 — PostgreSQL + Prisma
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O domínio (reservas, pagamentos, relações) é fortemente **relacional** e exige integridade e concorrência.
**Decisão:** **PostgreSQL** como banco e **Prisma** como ORM/migrations (tipado, integra com TS do monorepo).
**Alternativas:** MySQL (ok, menos recursos que PG); MongoDB (modelo de documento não combina com reservas/transações); ORMs TypeORM/Drizzle (Prisma vence em DX e migrations).
**Consequências:** (+) integridade, transações, full-text search nativo, tipos ponta a ponta. (−) Prisma abstrai SQL avançado — quando preciso, usar query raw/SQL.

## ADR-0005 — AWS como cloud + Cloudflare na borda (desde o início)
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O projeto mira escala e robustez **desde já** (decisão do produto), com infra reproduzível e padrão de mercado.
**Decisão:** **AWS** (ECS Fargate, RDS, ElastiCache, S3, CloudFront, SES, CloudWatch, Secrets Manager) provisionada por **Terraform**, com **Cloudflare** na frente (DNS, CDN, WAF, registrar). AWS **desde o dia 1**, sem etapa intermediária.
**Alternativas:** Supabase/Render/Railway + Cloudflare R2 (mais rápido de começar, mas teria migração depois — rejeitado pelo requisito "AWS desde o início"); GCP/Azure (equivalentes — AWS escolhida por maturidade/ecossistema/mercado).
**Consequências:** (+) escala, HA, padrão de mercado, currículo. (−) mais complexo e caro no início que um PaaS — mitigado por **dev local em Docker Compose** e IaC versionada.

## ADR-0006 — Replays em S3 + MediaConvert + CloudFront
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Replays exigem armazenar, **transcodificar** e entregar vídeo com escala — diferencial do produto.
**Decisão:** Upload → **S3**; transcode VOD → **MediaConvert**; entrega → **CloudFront** (URLs assinadas). **IVS** para ao vivo no futuro.
**Alternativas:** **Mux** (DX excelente — vira alternativa gerenciada se o pipeline AWS pesar); Cloudinary (foco imagem). 
**Consequências:** (+) tudo AWS-native, controle e custo a escala. (−) mais peças para orquestrar que um SaaS de vídeo pronto — isolar atrás de serviço de mídia.

## ADR-0007 — Monorepo com Turborepo
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Web, API e pacotes compartilham tipos/contratos/tokens; queremos consistência e build eficiente.
**Decisão:** **Turborepo + pnpm**; Flutter como app próprio dentro do repo. `packages/shared` (Zod/contratos), `packages/ui`, `packages/tokens`.
**Alternativas:** Polyrepo (divergência de contratos, mais overhead); **Nx** (mais poderoso/pesado — Turborepo é mais simples e suficiente).
**Consequências:** (+) contrato único, refactor atômico, cache de build. (−) repo maior e tooling de monorepo a manter.

## ADR-0008 — Conventional Commits + Trunk-based Development
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Histórico legível, releases automatizáveis e fluxo simples para um time pequeno.
**Decisão:** **Conventional Commits** (validado por commitlint + Husky), **SemVer** + changesets, e **trunk-based**/GitHub Flow (branches curtas + PR + review).
**Alternativas:** Gitflow (cerimônia demais p/ entrega contínua); commits livres (histórico ruim, sem automação).
**Consequências:** (+) changelog/release automáticos, PRs pequenos, CI/CD fluido. (−) exige disciplina — garantida por hooks no CI.

## ADR-0009 — Licença AGPL-3.0 (open-core)
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O Rally será **código aberto** e, ao mesmo tempo, um **produto** comercial.
**Decisão:** **AGPL-3.0** no core; **Apache-2.0** nos SDKs/contratos/tokens; **licença comercial** nos módulos enterprise (open-core). Detalhe em [Código Aberto, Licença e Projeções](../codigo-aberto.md).
**Alternativas:** MIT/Apache no projeto todo (permissivo, mas deixa concorrente fechar e revender — *free-riding*); BSL (source-available, não é OSI). Precedente: **Cal.com** (AGPL + comercial).
**Consequências:** (+) projeto genuinamente aberto e protegido contra SaaS fechado; modelo de negócio sustentável. (−) algumas empresas evitam AGPL — mitigado pelos SDKs em Apache. **Fixar antes de tornar o repo público.**

## ADR-0010 — Deploy AWS-native (SST/OpenNext + ECS Fargate)
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Manter tudo na AWS (decisão do ADR-0005), inclusive o front Next.js, sem depender de Vercel.
**Decisão:** Web (Next.js) via **SST/OpenNext** (Lambda + CloudFront + S3); API/workers em **ECS Fargate** (imagens no **ECR**); deploy pelo **GitHub Actions** com migrations Prisma como gate.
**Alternativas:** Vercel (melhor DX p/ Next, mas foge do "tudo AWS"); AWS Amplify (mais fechado); **EKS** (Kubernetes — overkill agora, fica como salto de escala futuro).
**Consequências:** (+) stack 100% AWS, custo previsível, IaC única. (−) deploy de Next serverless na AWS é mais trabalhoso que Vercel — aceito pelo requisito de AWS desde o início.

## ADR-0011 — Estratégia de multi-tenancy
**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** SaaS com muitos estabelecimentos no mesmo app; isolamento entre tenants é requisito de segurança (RN-16).
**Decisão (resumo):** banco/schema **compartilhados** com isolamento por `estabelecimentoId` aplicado de forma **centralizada** (app-level via Prisma), com **RLS do Postgres** como defesa em profundidade futura; schema/banco-por-tenant só no **enterprise**.
**Consequências:** (+) simples, nativo no Prisma, barato, entrega o MVP; caminho de endurecimento mapeado. (−) depende de escopo centralizado e testes de isolamento — risco de IDOR mitigado.
**Versão por extenso:** [ADR-0011 — Estratégia Multi-tenant](0011-multi-tenant.md).

---
> Próximos ADRs conforme o código evoluir (ex.: busca OpenSearch, event streaming Kafka, IA nos replays). Cada novo ADR recebe o próximo número e nunca se reescreve um aceito — cria-se um que o **substitui**.
