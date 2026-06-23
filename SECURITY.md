# Política de Segurança

## Reportar uma vulnerabilidade
**Não** abra issue pública para falhas de segurança.
Envie para **security@rally.app** (ou, na ausência, ao mantenedor) com:
- descrição e impacto, passos para reproduzir, versão/commit afetado.

Retornamos em até **5 dias úteis** e combinamos um prazo de correção e
**divulgação responsável** (coordenada). Agradecemos o report no changelog.

## Versões suportadas
A branch `main` e a última release recebem correções de segurança.

## Boas práticas no projeto
TLS, segredos no AWS Secrets Manager, dependências escaneadas (Dependabot/CodeQL),
validação em toda borda. Ver `docs/seguranca-lgpd.md`.
