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
- Padronização de código: `.editorconfig`, `.nvmrc`, Prettier, `.dockerignore` e `.gitattributes` (LF).
- `apps/api/prisma/migrations/README.md` — documenta a constraint anti-overbooking (RN-01).
- **Marco M2 — quadras, agenda e disponibilidade (API):** módulo `quadras` (vitrine com filtro
  por modalidade/busca, detalhe e **grade de horários** respeitando funcionamento, antecedência,
  colisão com reservas e faixas de preço), módulo `promocoes` (destaque da Home) e conversão de
  fuso do estabelecimento (`src/common/timezone.ts`).
- **Reserva ponta a ponta (API):** `POST /reservas` revalida o horário e o preço no servidor e
  resolve concorrência pelo índice único `(quadraId, inicio)` (409 em vez de overbooking);
  `GET /reservas/minhas` e `GET /reservas/:id`.
- **Pagamentos:** porta `PixProvider` com BR Code (EMV + CRC-16). Provedor de desenvolvimento
  local enquanto a AbacatePay não entra; confirmação simulada bloqueada em produção.
- **Replays:** `GET /replays/meus` com filtro por período.
- **App mobile (Flutter) — fluxo do cliente conforme o Figma:** Home, Detalhe da quadra
  (seletor de dia + grade), Checkout, Pagamento Pix (QR gerado do copia e cola), Confirmação,
  Replays, Perfil e Minhas reservas, com navegação inferior em `StatefulShellRoute`.
- **Design system no app:** tokens de tipografia (`AppText`), componentes reutilizáveis
  (chip, botões, cabeçalhos, selo de nota, marquee, estados vazio/erro) e ícones de linha
  exportados do Figma, tingidos por token.
- Testes da API: fuso horário (incluindo virada de DST), grade de disponibilidade, BR Code e
  compilação do grafo de injeção + rotas.

- **Landing v3 (web):** a página pública do Rally em `apps/web` — faixa "ao vivo",
  hero com foto real e selos flutuantes, manifesto, bento de recursos, como funciona,
  galeria com arrasto, citação do Projeto de Pesquisa, planos (RF-33), integrações,
  dúvidas em `details/summary` e chamada final texturizada, com rodapé de wordmark.
  Sora/Inter/Space Mono pelo `next/font`, rolagem suave (Lenis) e reveals (Framer
  Motion) respeitando `prefers-reduced-motion`; metadados, imagem de Open Graph
  gerada na build e dados estruturados (SoftwareApplication + FAQPage).
- **Primeiros testes da web:** `apps/web` ganhou Vitest + Testing Library (15 testes)
  cobrindo marcos de navegação, texto alternativo das fotos, âncoras com destino,
  dúvidas, planos e a regra de contraste do botão coral — `pnpm test` passa a cobrir
  também o site na CI.

### Alterado
- **Web:** as famílias de fonte do Tailwind passam a vir do `next/font` por variável
  CSS. O scaffold declarava Sora/Inter/Space Mono, mas nenhuma fonte era carregada —
  a página caía no sans-serif do sistema.
- **Hardening de CI:** `permissions: contents: read` (privilégio mínimo do `GITHUB_TOKEN`).
- **Dependabot:** agrupa PRs de GitHub Actions e de npm (minor/patch) e **trava o Node 22 LTS** no Docker (ignora bumps de major).
- Integração do fix do Copilot (PR #1): `pnpm-lock.yaml` e `packageManager` pinado (`pnpm@9.15.9`).
- **Modelo de dados:** `Estabelecimento` ganhou `bairro`, `nota` e `avaliacoes`; `Quadra` ganhou
  `comodidades` — campos que as telas do Figma exibem.
- **Seed** reescrito e **idempotente**, com os dois estabelecimentos das telas e fotos de exemplo
  servidas pela API em `/static` (só em desenvolvimento).
- App mobile: `Dio` e o cofre do token subiram para `core/network` (agora compartilhados por
  todas as features); splash e login passaram a usar o emblema oficial da marca.

---

> Ao chegar na primeira versão pública, criar a seção `## [0.1.0] - AAAA-MM-DD`
> movendo o conteúdo de "Não lançado".
