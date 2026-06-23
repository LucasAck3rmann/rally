# Contribuindo com o Rally

Obrigado pelo interesse! 🎾

## Ambiente
1. Node 22 + pnpm 9 + Docker. (Mobile: Flutter 3.x.)
2. `pnpm install` · `cp .env.example .env` · `docker compose up`.
3. `pnpm prisma migrate dev && pnpm prisma db seed` para o banco.

## Fluxo
- Crie uma branch curta a partir de `main`: `feat/...`, `fix/...`.
- Faça PRs pequenos e focados; descreva o "porquê".
- Garanta verde: `pnpm lint && pnpm typecheck && pnpm test`.
- Toda UI segue o `DESIGN.md` e a acessibilidade WCAG AA.

## Commits — Conventional Commits
`tipo(escopo): descrição` — ex.: `feat(reservas): trava de concorrência no slot`.
Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

## DCO (Developer Certificate of Origin)
Assine seus commits com `-s` (`git commit -s`). Isso adiciona
`Signed-off-by: Seu Nome <email>` e declara que você tem direito de contribuir o código.

## Licença das contribuições
Ao contribuir, você concorda em licenciar sua contribuição sob **AGPL-3.0**
(ou Apache-2.0 nos pacotes assim marcados). Adicione o cabeçalho SPDX em arquivos novos:

```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Rally
```
