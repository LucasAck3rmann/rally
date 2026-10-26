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
- **Proteção de sessão:** cookies `HttpOnly`/`Secure`/`SameSite` no web; _secure storage_ no Flutter.

## 3. OWASP Top 10 — mitigações

| Risco                       | Mitigação no Rally                                                                |
| --------------------------- | --------------------------------------------------------------------------------- |
| Broken Access Control       | RBAC server-side, checagem de _tenant_, evitar **IDOR** (validar dono do recurso) |
| Cryptographic Failures      | TLS em trânsito, criptografia em repouso, segredos fora do código                 |
| Injection                   | **Prisma** (queries parametrizadas) + validação (Zod/class-validator)             |
| Insecure Design             | _threat modeling_, ADRs, princípios desta página                                  |
| Security Misconfiguration   | headers seguros (**helmet/CSP**), CORS restrito, sem defaults expostos            |
| Vulnerable Components       | **Dependabot/Renovate** + **Snyk/CodeQL** no CI                                   |
| Auth Failures               | políticas de senha, rate limit em login, bloqueio por tentativa                   |
| Integrity Failures          | verificação de **assinatura de webhook**, builds confiáveis                       |
| Logging/Monitoring Failures | logs estruturados + **Sentry** + alertas                                          |
| SSRF                        | validação de URLs, egress controlado                                              |

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

- **Isolamento por estabelecimento (`tenant`):** toda query filtra por `estabelecimento_id`; _(reforço opcional: Row-Level Security no Postgres)_.
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
- **Consentimento** granular (banner de cookies _privacy-first_, opt-in de marketing/WhatsApp).
- **Princípios:** finalidade, necessidade/minimização, transparência, segurança.
- **Retenção e descarte:** política de prazo + **anonimização** de dados antigos; não guardar além do necessário.
- **Governança:** **Política de Privacidade** + **Termos de Uso**, registro das operações de tratamento, **encarregado (DPO)** nomeado, plano de resposta a **incidentes** (notificar ANPD e titulares quando aplicável).
- **Sub-operadores** (AWS, AbacatePay, Meta) listados; preferir processamento em região **BR/São Paulo** quando possível.

## 9. Continuidade e resposta

- **Backups** automáticos do RDS + **PITR**; testar restauração.
- **Disaster recovery** básico (RTO/RPO definidos); infra reproduzível por IaC.
- **Monitoramento/alertas** (Sentry, health checks, uptime); plano de incidentes documentado.

## 10. Checklist de segurança (pré-produção)

A lista anterior tinha dez itens e **nenhum marcado**, cinco linhas acima de
uma seção que afirmava que três deles estavam rodando no CI. Marcar tudo
seria a mentira oposta: metade da lista depende de um ambiente de produção que
não existe. A lista passa a separar as duas coisas, e **cada item marcado
aponta o que o prova** — arquivo, portão ou rota. Sem prova apontada, o item
fica aberto.

### 10.1 Verificado no repositório (25/10/2026)

- [x] **Cabeçalhos de segurança nas duas superfícies.** `nosniff`,
      `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`,
      `Permissions-Policy` e HSTS. Política em
      `apps/api/src/common/seguranca.ts` e `apps/web/next.config.mjs`,
      verificada por `seguranca.spec.ts` e `src/lib/cabecalhos.spec.ts`. As
      duas superfícies deixam de anunciar o arcabouço em `X-Powered-By`.
- [x] **CORS com lista de origem.** Era `enableCors()` sem argumento, que
      responde `Access-Control-Allow-Origin: *`. Agora a origem é a do
      `WEB_URL`, com credencial admitida — o navegador recusa o curinga junto
      de credencial, de modo que o curinga e a sessão em cookie eram
      incompatíveis.
- [x] **Senha com argon2.** `@node-rs/argon2` em `auth.service.ts` e
      `senha.service.ts`. O token de conta usa `sha256` por ter entropia
      completa, e o `token-de-conta.ts` explica por quê.
- [x] **RBAC e checagem de vínculo.** `JwtAuthGuard` e `PapelGuard`, com a
      suíte `identidade-do-token.spec.ts`, que exercita os manipuladores dos
      cinco controladores do cliente contra troca de identidade.
- [x] **Validação de entrada em toda borda.** `ValidationPipe({ whitelist:
true, transform: true })` global no `main.ts` — campo não declarado no
      DTO é **descartado**, não ignorado.
- [x] **Rate limiting nas rotas de credencial.** `ThrottlerModule.forRoot(LIMITES)`;
      os baldes e o que cada um protege estão em `modules/auth/limites.ts`. O
      alcance é **deliberadamente** só as cinco rotas de autenticação, e o
      motivo está escrito no `app.module.ts`: a grade de disponibilidade é
      consultada em rajada pela própria tela. O portão `toda-rota-tem-porta`
      afirma esse alcance nos dois sentidos — balde a menos numa rota de
      credencial abre tentativa de senha em volume, e balde a mais numa
      leitura derruba a tela, que foi o que aconteceu com o `/auth/me` em
      23/10.
- [x] **Toda rota tem porta, e a porta está declarada.** O portão
      `toda-rota-tem-porta` varre o `AppModule` e exige que cada uma das
      rotas esteja numa de cinco famílias — arena, "os meus dados",
      credencial, segredo de máquina e **aberta de propósito**. Rota nova
      fica fora de todas até alguém classificá-la, e nenhuma rota sem guarda
      pode escrever: leitura aberta é escolha de produto, escrita aberta não
      é escolha nenhuma.
- [x] **Webhook com segredo e idempotência.** `segredo-de-webhook.guard.ts`.
      Sem segredo configurado a rota responde **503 e não 401**: 401 diria
      "seu segredo está errado" quando o problema é o servidor não ter
      segredo nenhum.
- [x] **Scan de dependências no CI.** Dependabot, CodeQL e gitleaks — ver a
      seção 11.
- [x] **Nada de chave no Git.** `gitleaks` no CI, mais `.gitignore` e
      `.dockerignore` que impedem `.env` em commit e em imagem.
- [x] **Exportação e exclusão do titular.** `GET /privacidade/meus-dados` e
      `DELETE /privacidade/minha-conta`, com tela em `/gestao/privacidade`. O
      nome do arquivo exportado não leva identificador de pessoa.

### 10.2 Em aberto, com o motivo

- [ ] **CSP que barre script.** A CSP que o site manda hoje cobre só
      `frame-ancestors`. O App Router injeta script em linha em cada página —
      o estado da navegação e os dados do servidor —, e uma CSP sem `nonce`
      só passaria admitindo `'unsafe-inline'` em `script-src`, que é
      exatamente o que a CSP existe para barrar. O `nonce` depende de um
      `middleware.ts` que o projeto não tem. O teste
      `src/lib/cabecalhos.spec.ts` **reprova** se alguém "completar" a CSP
      pelo caminho do `unsafe-inline`.
- [ ] **Refresh token rotacionado.** O modelo `RefreshToken` existe no
      esquema, com `tokenHash`, `expiraEm` e `revogadoEm` — o desenho
      suporta rotação —, e **nenhuma rota o emite**: hoje só o serviço de
      privacidade o apaga. O login devolve um token de acesso de um dia.
- [ ] **Política de Privacidade, Termos de Uso e banner de consentimento.**
      Não há tela pública para nenhum dos três. O que existe é o fluxo do
      titular (10.1), que é outra coisa.
- [ ] **TLS de ponta a ponta e WAF.** Dependem do ambiente. O HSTS já vai no
      cabeçalho e o navegador o ignora em `http://localhost`, de modo que a
      primeira subida em produção não é a que esquece dele.
- [ ] **Segredos no Secrets Manager.** Hoje em arquivo de ambiente fora do
      Git. Depende do ambiente.
- [ ] **Backups testados, Sentry e logs ativos.** Dependem do ambiente.

## 11. Automação de segurança no repositório

- **CodeQL** (análise estática), **Dependabot** (dependências/alertas) e **gitleaks** (varredura de segredos) rodando no **CI** — ver `SECURITY.md`, `.github/workflows/codeql.yml`, `.github/dependabot.yml` e o job `security` em `ci.yml`.
- **SBOM** (CycloneDX) planejado para as releases; política de **divulgação responsável** em `SECURITY.md`.
- `.gitignore`/`.dockerignore` impedem commit/imagem com `.env`. Os segredos ficam hoje em **arquivo de ambiente fora do Git**; o **AWS Secrets Manager** é o destino em produção, e está aberto em 10.2 — dizer que já é o único lugar seria afirmar o que não acontece.
- **Workflows com privilégio mínimo:** `permissions: contents: read` no CI; Dependabot com PRs **agrupados** e **Node 22 LTS travado** no Docker (ignora majors).

> Referências: OWASP Top 10 / ASVS · AWS Well-Architected (Security) · LGPD (Lei 13.709/2018) · ANPD. Base teórica em [Fundamentação Teórica e Padrões](fundamentacao.md) · implementação em [Arquitetura e Stack](arquitetura.md).
