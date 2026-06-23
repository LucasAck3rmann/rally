# Infraestrutura

Infraestrutura do Rally — **AWS desde o início**, provisionada por **Terraform** (IaC),
com **Cloudflare** na borda. Visão completa em [`../docs/arquitetura.md`](../docs/arquitetura.md).

## Conteúdo
- `terraform/` — definição da infra AWS (VPC, RDS, ElastiCache, ECS Fargate, ECR, S3,
  CloudFront, SES, Secrets Manager) — ver [`terraform/README.md`](terraform/README.md).
- Dockerfiles das aplicações ficam em `apps/api/Dockerfile` e `apps/web/Dockerfile`.
- `docker-compose.yml` (raiz) sobe o ambiente de **desenvolvimento** (postgres, redis,
  localstack, api, web).

## Ambientes
`dev` (Docker local) → `staging` (pré-produção AWS) → `production`. Configuração por
ambiente (12-Factor); segredos no **AWS Secrets Manager** (nunca no Git).

## Princípios
- Tudo versionado (IaC) e reproduzível; nada de mudança manual no console.
- Privilégio mínimo (IAM por serviço); rede privada para banco/cache.
- Observabilidade: CloudWatch + Sentry + OpenTelemetry.
