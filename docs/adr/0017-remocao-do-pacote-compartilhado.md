# ADR-0017 — Remoção do `packages/shared`

**Status:** Aceito · **Data:** 2026-10-25 · **Substitui parcialmente:** [ADR-0007](README.md)

## Contexto

O ADR-0007 decidiu o monorepo com Turborepo e nomeou três pacotes, entre eles `packages/shared`, descrito como "Zod/contratos". A consequência registrada ali era **contrato único**: um esquema compartilhado entre as superfícies, para que web e aplicativo não divergissem da API.

Quatro meses depois, o pacote tinha exatamente um esquema — `criarReservaSchema`, a validação da criação de reserva — e **nenhum consumidor**. A medição é direta: nenhum `package.json` o declarava como dependência e nenhum arquivo o importava.

| Pacote          | Declarado por | Importado em                                                     |
| --------------- | ------------- | ---------------------------------------------------------------- |
| `@rally/tokens` | 1 manifesto   | **22 arquivos**                                                  |
| `@rally/shared` | nenhum        | nenhum                                                           |
| `@rally/ui`     | nenhum        | nenhum (contém só um `.gitkeep`)                                 |
| `@rally/config` | nenhum        | nenhum (o `tsconfig.base.json` dele não é estendido por ninguém) |

O que aconteceu na prática foi o contrário do previsto: **cada superfície passou a validar na própria borda**. A API valida a entrada com DTOs do `class-validator`, que é o que o `ValidationPipe` do NestJS executa; a web valida a resposta com esquemas Zod em `apps/web/src/lib`, onde o `safeParse` recusa resposta fora do formato. Nenhuma das duas tinha motivo para importar o esquema do pacote, e nenhuma importou.

Isso tornou o `criarReservaSchema` uma **segunda fonte de verdade sobre a mesma regra** — a validação da criação de reserva —, sem teste, sem execução e sem ninguém que a mantivesse alinhada com os DTOs que de fato validam. O Dependabot continuava atualizando o `zod` lá dentro.

## Decisão

O `packages/shared` é **removido**. A documentação que o descrevia como contrato em uso é corrigida: o `governanca.md` afirmava que "web/mobile consomem contratos de `packages/shared`", e isso nunca foi verdade.

A entrada do ADR-0007 **não é reescrita** — decisão aceita não se reescreve, e o registro de que o contrato único foi tentado tem valor próprio. Esta decisão substitui a parte dele que previa o pacote.

## Alternativas consideradas

**Ligar a web ao pacote**, fazendo-a validar o pedido de reserva com o `criarReservaSchema` em vez do contrato próprio. Recusada por inverter a responsabilidade: quem valida entrada de verdade é o servidor, e o esquema no cliente seria uma cópia que precisa ser mantida em acordo com os DTOs sem nada que force esse acordo. Um esquema que o servidor não executa não é contrato; é uma segunda opinião.

**Deixar como estava.** Recusada porque o custo não é zero: o pacote aparecia na documentação como se estivesse em uso, entrava na tabela de licenças, consumia atualização de dependência e convidava alguém a importá-lo achando que era a fonte de verdade.

**Gerar o contrato a partir do OpenAPI** que a API publica, que é a forma de ter fonte única sem cópia mantida à mão. Não é feito aqui — fica registrado como o caminho que o `arquitetura.md` já aponta, e que não depende deste pacote existir.

## Consequências

**(+)** Some uma segunda fonte de verdade sobre validação de reserva que nunca era exercitada, e com ela a dependência de `zod` num pacote morto.

**(+)** A documentação passa a descrever o que o repositório faz. A fronteira entre `apps/*` e `packages/*` continua existindo — o `@rally/tokens` é consumido por 22 arquivos da web —, e agora o texto cita o pacote que de fato atravessa essa fronteira.

**(−)** Se um dia houver contrato compartilhado de verdade, o pacote precisa ser recriado. O histórico guarda o esquema, e o caminho preferido passa a ser o do OpenAPI.

**(−)** `packages/ui` e `packages/config` continuam sem consumidor, pela mesma medição. Não são removidos aqui porque esta decisão foi tomada sobre o `shared`; ficam **declarados** como pendência em vez de sumirem sem registro.
