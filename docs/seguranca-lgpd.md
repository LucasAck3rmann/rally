# Segurança, Privacidade e LGPD

> Como o Rally protege dados e usuários — requisito **não-funcional crítico** de um SaaS que lida com cadastros, agendamentos e **pagamentos**. Complementa [Arquitetura e Stack](arquitetura.md) e fundamenta o capítulo de segurança do TCC. Padrões de referência: **OWASP** e **AWS Well-Architected (pilar de segurança)**.

## 1. Princípios
- **Defesa em profundidade** (várias camadas: borda, app, dados).
- **Privilégio mínimo** (IAM, papéis, escopos de token).
- **Seguro por padrão** e **privacy by design/default** (LGPD art. 46–49).
- **Validar em toda borda**; nunca confiar no cliente.

## 2. Autenticação e autorização
- **Senhas** com hash forte (**bcrypt/argon2**, salt) — nunca em texto puro.
- **JWT** access (curto) + **refresh token** (rotacionado, revogável); logout invalida sessão.
- **OAuth social** (Google/Instagram) via Passport; **MFA** opcional para contas de gestão.
- **RBAC** (papéis: cliente · atendente · financeiro · admin · mantenedor/SaaS) — autorização verificada no back-end, não só na UI.
- **Proteção de sessão:** cookies `HttpOnly`/`Secure`/`SameSite` no web; *secure storage* no Flutter.

## 3. OWASP Top 10 — mitigações
| Risco | Mitigação no Rally |
|---|---|
| Broken Access Control | RBAC server-side, checagem de *tenant*, evitar **IDOR** (validar dono do recurso) |
| Cryptographic Failures | TLS em trânsito, criptografia em repouso, segredos fora do código |
| Injection | **Prisma** (queries parametrizadas) + validação (Zod/class-validator) |
| Insecure Design | *threat modeling*, ADRs, princípios desta página |
| Security Misconfiguration | headers seguros (**helmet/CSP**), CORS restrito, sem defaults expostos |
| Vulnerable Components | **Dependabot/Renovate** + **Snyk/CodeQL** no CI |
| Auth Failures | políticas de senha, rate limit em login, bloqueio por tentativa |
| Integrity Failures | verificação de **assinatura de webhook**, builds confiáveis |
| Logging/Monitoring Failures | logs estruturados + **Sentry** + alertas |
| SSRF | validação de URLs, egress controlado |

## 4. Proteção de dados
- **Em trânsito:** **TLS 1.2+** em tudo (Cloudflare/ALB).
- **Em repouso:** criptografia de RDS/S3 (**AWS KMS**); discos e backups cifrados.
- **Segredos:** **AWS Secrets Manager/SSM** (ou `.env` fora do versionamento) — nunca commitar chaves.
- **IAM com privilégio mínimo** por serviço; chaves rotacionadas.
- **PII minimizada:** coletar só o necessário; mascarar em logs.

## 5. Segurança de aplicação
- **Validação de entrada** em toda rota (Zod/class-validator) + sanitização.
- **Rate limiting / throttling** (NestJS + Cloudflare WAF) contra abuso e brute force.
- **CORS** restrito a origens conhecidas; **CSRF** tratado (tokens/SameSite).
- **Security headers** (helmet, **CSP**, HSTS); **WAF** Cloudflare na borda (DDoS, bots).
- **Uploads:** validar tipo/tamanho, varrer, servir de domínio isolado, links S3 **assinados e expiráveis**.

## 6. Multi-tenancy (SaaS)
- **Isolamento por estabelecimento (`tenant`):** toda query filtra por `estabelecimento_id`; *(reforço opcional: Row-Level Security no Postgres)*.
- Evitar **vazamento entre tenants** (testes específicos de autorização).
- **Auditoria:** trilha de quem fez o quê (ações sensíveis de gestão e financeiro).

## 7. Segurança de pagamentos
- **Não armazenar dados de cartão** — delegados ao gateway (**AbacatePay**); o SaaS não entra no escopo pesado de **PCI-DSS**.
- **Webhooks assinados** (verificar HMAC) + **idempotência** (evita cobrança/baixa duplicada).
- Conciliação: status do pagamento é a fonte de verdade do gateway, confirmada por webhook.

## 8. LGPD (Lei 13.709/2018)
- **Papéis:** o estabelecimento é **controlador** dos dados dos clientes; o Rally atua como **operador** (e controlador dos dados de conta) — definir em contrato/Termos.
- **Bases legais:** execução de contrato (reserva), consentimento (marketing), legítimo interesse (segurança/antifraude).
- **Direitos do titular** (atendidos por funcionalidade): acesso, correção, **portabilidade/exportação**, **eliminação** ("excluir minha conta"), revogação de consentimento.
- **Consentimento** granular (banner de cookies *privacy-first*, opt-in de marketing/WhatsApp).
- **Princípios:** finalidade, necessidade/minimização, transparência, segurança.
- **Retenção e descarte:** política de prazo + **anonimização** de dados antigos; não guardar além do necessário.
- **Governança:** **Política de Privacidade** + **Termos de Uso**, registro das operações de tratamento, **encarregado (DPO)** nomeado, plano de resposta a **incidentes** (notificar ANPD e titulares quando aplicável).
- **Sub-operadores** (AWS, AbacatePay, Meta) listados; preferir processamento em região **BR/São Paulo** quando possível.

## 9. Continuidade e resposta
- **Backups** automáticos do RDS + **PITR**; testar restauração.
- **Disaster recovery** básico (RTO/RPO definidos); infra reproduzível por IaC.
- **Monitoramento/alertas** (Sentry, health checks, uptime); plano de incidentes documentado.

## 10. Checklist de segurança (pré-produção)
- [ ] TLS em tudo; HSTS ativo
- [ ] Senhas com argon2/bcrypt; refresh token rotacionado
- [ ] RBAC + checagem de tenant em todas as rotas (sem IDOR)
- [ ] Validação/sanitização de entrada em toda borda
- [ ] Rate limiting + WAF + headers (CSP/helmet)
- [ ] Segredos no Secrets Manager; nada de chave no Git
- [ ] Webhooks com assinatura + idempotência
- [ ] Scan de dependências no CI (Dependabot/Snyk/CodeQL)
- [ ] Backups testados; Sentry e logs ativos
- [ ] Política de Privacidade, Termos, consentimento e fluxo de exclusão (LGPD)

## 11. Automação de segurança no repositório
- **CodeQL** (análise estática), **Dependabot** (dependências/alertas) e **gitleaks** (varredura de segredos) rodando no **CI** — ver `SECURITY.md`, `.github/workflows/codeql.yml`, `.github/dependabot.yml` e o job `security` em `ci.yml`.
- **SBOM** (CycloneDX) planejado para as releases; política de **divulgação responsável** em `SECURITY.md`.
- `.gitignore`/`.dockerignore` impedem commit/imagem com `.env`; segredos só em **AWS Secrets Manager**.
- **Workflows com privilégio mínimo:** `permissions: contents: read` no CI; Dependabot com PRs **agrupados** e **Node 22 LTS travado** no Docker (ignora majors).

> Referências: OWASP Top 10 / ASVS · AWS Well-Architected (Security) · LGPD (Lei 13.709/2018) · ANPD. Base teórica em [Fundamentação Teórica e Padrões](fundamentacao.md) · implementação em [Arquitetura e Stack](arquitetura.md).
