# Governança do Projeto

Como o Rally é conduzido. A versão completa está em [`docs/governanca.md`](docs/governanca.md).

## Papéis
- **Mantenedor (atual):** [@LucasAck3rmann](https://github.com/LucasAck3rmann) — decisão final, releases, segurança.
- **Contribuidores:** qualquer pessoa via PR (ver [CONTRIBUTING.md](CONTRIBUTING.md)).
- Donos de área definidos em [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Como decidimos
| Tipo de decisão | Instrumento |
|---|---|
| Arquitetura / stack / tecnologia | **ADR** em [`docs/adr/`](docs/adr/) (contexto → decisão → consequências) |
| Mudança grande de produto/processo | **RFC** (issue iniciada por `RFC:`) |
| Mudança pequena | **PR** com descrição do "porquê" |

Decisão relevante **não vive só na cabeça de alguém** — vira ADR/RFC. Um ADR aceito
não é reescrito; cria-se outro que o substitui.

## Fluxo de contribuição
1. Issue/discussão → 2. Branch curta (`feat/…`, `fix/…`) → 3. PR pequeno + review (CODEOWNERS)
→ 4. CI verde (lint, typecheck, test, build, CodeQL) → 5. Merge (squash, Conventional Commit).

## Releases
**SemVer** + `CHANGELOG.md`. Correções de segurança têm prioridade e podem sair fora de cadência
(ver [SECURITY.md](SECURITY.md)).

## Licença e modelo
Core **AGPL-3.0**; SDKs/pacotes públicos em Apache-2.0; edição comercial/enterprise à parte
(open-core). Detalhes em [`docs/codigo-aberto.md`](docs/codigo-aberto.md).
