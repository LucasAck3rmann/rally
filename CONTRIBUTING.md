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
(ou Apache-2.0 nos pacotes assim marcados). Em arquivo novo de código, o
cabeçalho é **uma linha só**, na **primeira** linha do arquivo:

<!-- REUSE-IgnoreStart -->
```ts
// SPDX-License-Identifier: AGPL-3.0-or-later
```
<!-- REUSE-IgnoreEnd -->

Não acrescente linha de copyright no arquivo: o copyright do repositório está
centralizado no `REUSE.toml`. Em `packages/shared` e `packages/tokens` o
identificador é `Apache-2.0`, não AGPL.

O que **não** leva cabeçalho: arquivo gerado (como `apps/web/next-env.d.ts`,
as migrações do Prisma e o scaffolding do Flutter), arquivo que não aceita
comentário (`.json`), documentação e ativos. Tudo isso é declarado no
`REUSE.toml`.

A CI roda `reuse lint` no job `licenca` e falha se algum arquivo ficar sem
declaração. Para rodar antes de abrir o PR:

```bash
pipx run reuse lint
```
