# Terraform — Infra AWS do Rally

Definição da infraestrutura como código. **Ainda não implementado** (entra na fase de
estabilização/deploy — ver `docs/cronograma.md`, marco M5).

## Estrutura sugerida
```
terraform/
├─ environments/
│  ├─ staging/        # tfvars + backend do ambiente
│  └─ production/
├─ modules/
│  ├─ network/        # VPC, subnets, security groups
│  ├─ database/       # RDS PostgreSQL (Multi-AZ) + ElastiCache Redis
│  ├─ compute/        # ECS Fargate + ALB + ECR
│  ├─ storage/        # S3 + CloudFront (+ MediaConvert)
│  └─ email/          # SES
└─ backend.tf         # state remoto (S3 + DynamoDB lock)
```

## Convenções
- **State remoto** em S3 com lock no DynamoDB (nunca state local commitado).
- Um workspace/conjunto de tfvars por ambiente.
- `terraform plan` no CI em PRs; `apply` só após review (ver `docs/adr/0010` — deploy AWS-native).
- Segredos via **AWS Secrets Manager**/SSM, referenciados por data source — nunca em `.tf`.

## Comandos (quando implementado)
```bash
cd environments/staging
terraform init
terraform plan
terraform apply
```
