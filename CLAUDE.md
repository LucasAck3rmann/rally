# Rally — Plataforma de Quadras de Areia

Plataforma de **agendamento, gestão e replays** para quadras de areia (beach tennis,
futevôlei, vôlei), evoluindo para gestão de **clubes esportivos**. Produto + TCC (IFSul).
**Open source — AGPL-3.0 (open-core).** Cloud **AWS desde o início**.
Documentação de produto/design/engenharia detalhada vive no Obsidian Vault e em `docs/`.

## Stack (v3 — produção; AWS desde o início)
- **Monorepo:** Turborepo + pnpm (`apps/web`, `apps/api`, `packages/*`); mobile Flutter em `apps/mobile`
- **Web:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · TanStack Query + Zustand · React Hook Form + Zod
- **Mobile:** Flutter (Dart 3) + Riverpod + go_router + Dio (clean architecture)
- **Back-end/API:** NestJS (Node + TS) modular · REST + OpenAPI · Prisma
- **Banco:** PostgreSQL (Prisma migrations) · Redis + BullMQ (cache/filas)
- **Auth:** JWT (access+refresh) + Passport + OAuth social (Google/IG) · argon2
- **Pagamentos:** AbacatePay (Pix) + cartão · webhook assinado e idempotente
- **Notificações:** WhatsApp Cloud API · Push (FCM/APNs) · e-mail AWS SES · in-app
- **Mídia/replays:** AWS S3 → MediaConvert → CloudFront (IVS p/ live no futuro)
- **Cloud (AWS, dia 1):** ECS Fargate · ECR · RDS (Postgres Multi-AZ) · ElastiCache (Redis) · S3 · CloudFront · SES · CloudWatch · Secrets Manager · Terraform (IaC)
- **Borda:** Cloudflare (DNS · WAF · CDN · Registrar)
- **Infra/Deploy:** Docker + docker-compose (dev) · GitHub Actions · Sentry/OTel · deploy AWS-native (web via SST/OpenNext, api em ECS Fargate)

## Convenções
- TypeScript estrito; componentes funcionais; nomes em inglês no código, UI em pt-BR.
- Use os tokens do design system — **não** cravar hex fora da paleta Rally.
- Acessibilidade WCAG AA: texto sobre coral é grafite (nunca branco); foco visível; alvos ≥ 44px.
- Server Components por padrão; Client Components só quando precisar de interatividade.
- Variáveis de ambiente via `.env` (nunca commitar segredos; em prod, AWS Secrets Manager).
- **Licença:** core em **AGPL-3.0** — cabeçalho SPDX por arquivo; `packages/*` públicos em Apache-2.0.
- **Commits:** Conventional Commits (commitlint/Husky); branches curtas + PR com review.
- **Multi-tenant:** toda query filtra por `estabelecimentoId`; nunca expor dado de outro tenant (ver `docs/adr/0011-multi-tenant.md`).

## Modelo de dados (entidades)
Estabelecimento, Quadra, Modalidade, Usuário (cliente + papéis de gestão via Membership), Reserva,
Pagamento, Material, Promoção/Cupom, Evento/Torneio, Replay/Clipe. Schema em `apps/api/prisma/schema.prisma`.
Futuro (clubes): Jogador, Time, Plano/Mensalidade, Aula.

## Estrutura (monorepo)
- `apps/web/` — Next.js (site, app cliente, painel `/admin`)
- `apps/api/` — NestJS; `src/modules/{auth,reservas,pagamentos,replays,...}`
- `apps/mobile/` — Flutter (data/domain/presentation)
- `packages/shared` (tipos/Zod) · `packages/ui` · `packages/tokens` · `packages/config`
- `infra/` (docker, Terraform) · `docs/adr/` (decisões) · `docker-compose.yml`

## Comandos
- `docker compose up` — sobe web + api + postgres + redis + localstack
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test`
- `pnpm prisma migrate dev` · `pnpm prisma db seed` · `flutter run` (mobile)

## Roadmap (fases)
0. Fundação/TCC: cadastro, quadras+agenda, reserva, painel básico
1. Produto: pagamentos, WhatsApp, preços dinâmicos, CRM, materiais
2. Replays: câmera + clipes + compartilhamento
3. Eventos & comunidade
4. Clubes esportivos

## Ao trabalhar aqui
- Consulte o `DESIGN.md` (raiz) antes de criar/editar qualquer UI.
- Rode `typecheck`, `lint` e `test` antes de concluir; CI deve passar antes do merge.
- Decisão de stack/arquitetura → registre um **ADR** em `docs/adr/` (não troque tech sem ADR).
- Siga Conventional Commits; prefira atualizar componentes existentes a duplicar.
