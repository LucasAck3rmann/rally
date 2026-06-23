# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e versionamento [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Fundação do repositório: documentação de engenharia, configuração e modelo de dados (`schema.prisma` + seed).
- Licença **AGPL-3.0** (open-core) e governança OSS (CONTRIBUTING/DCO, SECURITY, CODE_OF_CONDUCT, templates, CODEOWNERS).
- Monorepo Turborepo + pnpm; `docker-compose` de desenvolvimento com LocalStack (S3/SES).
- CI (GitHub Actions): lint, typecheck, test, build e build de imagens.
- **Segurança/governança:** Dependabot, **CodeQL** e varredura de segredos (**gitleaks**) no CI; `GOVERNANCE.md`, `SUPPORT.md`, `CHANGELOG.md`.
- Padronização de código: `.editorconfig`, `.nvmrc`, Prettier e `.dockerignore`.

---

> Ao chegar na primeira versão pública, criar a seção `## [0.1.0] - AAAA-MM-DD`
> movendo o conteúdo de "Não lançado".
