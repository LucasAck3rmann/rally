# Estrutura do Monorepo (scaffold)

> Esqueleto **pronto para levar pro Cursor/Claude Code**: a árvore de pastas + arquivos-base (Docker, commitlint, CI, Turborepo). Copie cada bloco para o caminho indicado. Reflete [Arquitetura e Stack](arquitetura.md) (AWS-first) e [Decisões de Arquitetura (ADRs)](adr/README.md). O `CLAUDE.md` e o `DESIGN.md` da raiz já estão em [CLAUDE.md (modelo para o repo de código)](../CLAUDE.md) e [DESIGN.md (raiz do repo)](../DESIGN.md).

## 1. Árvore de pastas
```text
rally/
├─ apps/
│  ├─ web/                      # Next.js (site + painel + landing)
│  │  ├─ src/app/               # rotas (App Router)
│  │  ├─ src/components/        # UI da app (usa packages/ui)
│  │  ├─ src/lib/               # api client, auth, utils
│  │  ├─ Dockerfile
│  │  └─ package.json
│  ├─ api/                      # NestJS (REST + workers)
│  │  ├─ src/
│  │  │  ├─ modules/            # auth, usuarios, estabelecimentos,
│  │  │  │                      # quadras, reservas, pagamentos,
│  │  │  │                      # notificacoes, replays, relatorios
│  │  │  │  └─ reservas/
│  │  │  │     ├─ reservas.controller.ts
│  │  │  │     ├─ reservas.service.ts
│  │  │  │     ├─ reservas.repository.ts
│  │  │  │     ├─ dto/
│  │  │  │     └─ reservas.module.ts
│  │  │  ├─ common/             # guards, interceptors, filters, pipes
│  │  │  ├─ config/             # @nestjs/config + validação
│  │  │  ├─ jobs/               # workers BullMQ
│  │  │  ├─ app.module.ts
│  │  │  └─ main.ts
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  ├─ test/                  # e2e (Supertest)
│  │  ├─ Dockerfile
│  │  └─ package.json
│  └─ mobile/                   # Flutter (Dart) — clean architecture
│     ├─ lib/
│     │  ├─ data/  ├─ domain/  └─ presentation/
│     ├─ test/
│     └─ pubspec.yaml
├─ packages/
│  ├─ shared/                   # tipos, schemas Zod, contratos da API
│  ├─ ui/                       # componentes web (shadcn + tokens)
│  ├─ tokens/                   # Style Dictionary (Figma → Tailwind/Flutter)
│  └─ config/                   # eslint, tsconfig, tailwind preset (compartilhados)
├─ docs/
│  ├─ adr/                      # 0001-nestjs.md, 0002-flutter.md, ...
│  └─ DESIGN.md
├─ infra/                       # Terraform (AWS) + Dockerfiles base
│  ├─ README.md
│  └─ terraform/README.md
├─ .github/
│  ├─ workflows/ci.yml · codeql.yml     # build/test + segurança (CodeQL)
│  ├─ dependabot.yml                     # atualização de dependências
│  ├─ ISSUE_TEMPLATE/  ·  pull_request_template.md
│  └─ CODEOWNERS
├─ .husky/                      # hooks git (commit-msg, pre-commit)
├─ docker-compose.yml           # postgres + redis + localstack + api + web
├─ commitlint.config.js · turbo.json · pnpm-workspace.yaml · package.json
├─ .editorconfig · .nvmrc · .prettierrc.json · .prettierignore
├─ .env.example · .gitignore · .dockerignore
├─ CLAUDE.md  ·  DESIGN.md  ·  README.md
├─ LICENSE (AGPL-3.0)  ·  CONTRIBUTING.md  ·  CODE_OF_CONDUCT.md  ·  SECURITY.md
├─ GOVERNANCE.md  ·  SUPPORT.md  ·  CHANGELOG.md
```

## 2. `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
> `apps/mobile` (Flutter) não entra no workspace pnpm — é gerenciado pelo `pub` do Dart, mas vive no mesmo repositório.

## 3. `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint":      {},
    "typecheck": { "dependsOn": ["^build"] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "dev":       { "cache": false, "persistent": true }
  }
}
```

## 4. `docker-compose.yml` (dev — paridade com AWS via LocalStack)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: rally
      POSTGRES_PASSWORD: rally
      POSTGRES_DB: rally
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rally"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7
    ports: ["6379:6379"]

  localstack:                     # emula S3 + SES da AWS no dev
    image: localstack/localstack:3
    environment:
      SERVICES: s3,ses
    ports: ["4566:4566"]

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile, target: dev }
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_started }
    ports: ["3333:3333"]
    volumes: ["./apps/api:/app/apps/api", "/app/node_modules"]
    command: pnpm --filter @rally/api dev

  web:
    build: { context: ., dockerfile: apps/web/Dockerfile, target: dev }
    env_file: .env
    depends_on: ["api"]
    ports: ["3000:3000"]
    volumes: ["./apps/web:/app/apps/web", "/app/node_modules"]
    command: pnpm --filter @rally/web dev

volumes:
  pgdata:
```

## 5. `.env.example`
```dotenv
# App
NODE_ENV=development
API_PORT=3333
WEB_URL=http://localhost:3000

# Banco / cache
DATABASE_URL=postgresql://rally:rally@localhost:5432/rally?schema=public
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=changeme
JWT_REFRESH_SECRET=changeme

# AWS (LocalStack no dev)
AWS_REGION=sa-east-1
AWS_ENDPOINT=http://localhost:4566
S3_BUCKET=rally-media
SES_FROM=no-reply@rally.local

# Pagamentos / mensageria
ABACATEPAY_API_KEY=
ABACATEPAY_WEBHOOK_SECRET=
WHATSAPP_TOKEN=
```

## 6. Padronização de commits

### `commitlint.config.js`
```js
module.exports = { extends: ["@commitlint/config-conventional"] };
```

### `.husky/commit-msg`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx --no -- commitlint --edit "$1"
```

### `.husky/pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

### Trecho do `package.json` (raiz)
```json
{
  "name": "rally",
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  },
  "devDependencies": {
    "@commitlint/cli": "^19",
    "@commitlint/config-conventional": "^19",
    "husky": "^9",
    "lint-staged": "^15",
    "prettier": "^3",
    "turbo": "^2"
  }
}
```
> Tipos de commit: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`. Ex.: `feat(reservas): trava de concorrência no slot`.

## 7. CI — `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: {}

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  docker:
    needs: build-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -f apps/api/Dockerfile -t rally-api .
      - run: docker build -f apps/web/Dockerfile -t rally-web .
  # deploy: push no ECR + update do serviço ECS (no merge em main) — ver ADR-0010
```

## 8. `Dockerfile` da API (multi-stage, exemplo)
```dockerfile
# base
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# dev
FROM base AS dev
COPY . .
CMD ["pnpm", "--filter", "@rally/api", "dev"]

# build → produção
FROM base AS build
COPY . .
RUN pnpm --filter @rally/api build && pnpm prisma generate
FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3333
CMD ["node", "dist/main.js"]
```

## 9. Ordem de scaffold (no Cursor)
1. `pnpm dlx create-turbo@latest` → ajustar para a árvore acima.
2. `apps/api`: `nest new` dentro do workspace + Prisma (`pnpm dlx prisma init`).
3. `apps/web`: `create-next-app` (TS, Tailwind, App Router).
4. `apps/mobile`: `flutter create` com a estrutura clean.
5. `packages/shared|ui|tokens|config`.
6. Husky + commitlint + lint-staged + Prettier/ESLint (configs em `packages/config`).
7. `docker-compose up` e validar `web↔api↔postgres↔redis↔localstack`.
8. `infra/terraform`: VPC, RDS, ElastiCache, ECS, S3, CloudFront (incremental).
9. Apontar `CLAUDE.md` e `.cursor/rules` para o `DESIGN.md` e a skill `rally-design-system`.

> Conexões: [Arquitetura e Stack](arquitetura.md) · [Decisões de Arquitetura (ADRs)](adr/README.md) · [Código Aberto, Licença e Projeções](codigo-aberto.md) · [Requisitos](requisitos.md).
