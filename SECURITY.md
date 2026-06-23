# Política de Segurança

## Reportar uma vulnerabilidade
**Não** abra issue pública para falhas de segurança.
Envie para **security@rally.app** (ou, na ausência, ao mantenedor) com:
- descrição e impacto, passos para reproduzir, versão/commit afetado.

Retornamos em até **5 dias úteis** e combinamos um prazo de correção e
**divulgação responsável** (coordenada). Agradecemos o report no changelog.

## Versões suportadas
| Versão | Suporte a segurança |
|---|---|
| `main` (desenvolvimento) | ✅ |
| última release estável | ✅ |
| versões anteriores | ❌ |

## Segurança automatizada (CI)
- **CodeQL** — análise estática de segurança (`.github/workflows/codeql.yml`).
- **Dependabot** — atualização de dependências e alertas (`.github/dependabot.yml`).
- **gitleaks** — varredura de segredos em cada push/PR (job `security` em `ci.yml`).
- **SBOM** (planejado) — inventário CycloneDX nas releases.

## Boas práticas no projeto
TLS em tudo; segredos no **AWS Secrets Manager** (nunca no Git); validação em toda borda;
multi-tenant isolado por `estabelecimentoId`; senhas com argon2; webhooks assinados.
Detalhes, OWASP Top 10 e LGPD em [`docs/seguranca-lgpd.md`](docs/seguranca-lgpd.md).
