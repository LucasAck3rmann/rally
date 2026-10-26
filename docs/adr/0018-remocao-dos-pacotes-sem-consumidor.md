# ADR-0018 — Remoção do `packages/ui` e do `packages/config`

**Status:** Aceito · **Data:** 2026-10-26 · **Fecha a pendência de:** [ADR-0017](0017-remocao-do-pacote-compartilhado.md) · **Substitui parcialmente:** [ADR-0007](README.md)

## Contexto

O [ADR-0017](0017-remocao-do-pacote-compartilhado.md) removeu o `packages/shared` e deixou escrito, como consequência negativa, que os outros dois pacotes seguiam sem consumidor **pela mesma medição** — declarados como pendência em vez de sumirem sem registro. Esta é a decisão que fecha aquela pendência.

A medição, refeita em 26/10 contra a `main`:

| Pacote          | Conteúdo                               | Declarado por | Importado em    |
| --------------- | -------------------------------------- | ------------- | --------------- |
| `@rally/tokens` | `src/index.ts`                         | 1 manifesto   | **22 arquivos** |
| `@rally/ui`     | um `.gitkeep`, e nada mais             | nenhum        | nenhum          |
| `@rally/config` | um manifesto e um `tsconfig.base.json` | nenhum        | nenhum          |

O `packages/ui` nunca teve nem `package.json`: só a pasta e o arquivo que a mantém no histórico. Ele não é um pacote do espaço de trabalho — o pnpm ignora diretório sem manifesto —, é uma pasta vazia com nome de promessa.

O `packages/config` tem manifesto, e o `tsconfig.base.json` dele **não é estendido por ninguém**: o único arquivo do repositório que menciona `tsconfig.base` é o próprio manifesto, no campo `files`.

## A documentação afirmava três coisas que não aconteciam

Esta é a parte que importa mais que as duas pastas, e é a mesma classe de problema que o ADR-0017 corrigiu no `governanca.md`:

1. **`arquitetura.md`** dizia "Componentização: web em `packages/ui` (shadcn + tokens)". Os componentes da web moram em `apps/web/src/components`, e sempre moraram.
2. **`estrutura-monorepo.md`** dizia, no comentário da árvore, que `apps/web/src/components` "usa `packages/ui`", e, na seção de passos, que as configurações de Prettier e ESLint ficam "em `packages/config`". Elas ficam na **raiz** — `.prettierrc.json`, `eslint.config.mjs`, `commitlint.config.js`.
3. **`governanca.md`** dizia, como regra de processo, que "novo componente entra em `packages/ui` (web)". Nenhum dos componentes existentes entrou por ali.

Pasta vazia com nome bom é pior que pasta nenhuma: ela faz a documentação soar verdadeira e convida o próximo componente a ir para um lugar que ninguém usa.

## Decisão

As duas pastas são **removidas**, e as três afirmações acima passam a descrever o repositório como ele é.

Some também a nota de licenciamento do `codigo-aberto.md` que explicava por que o `packages/config` ficava AGPL em vez de Apache, e a contagem de "os cinco `package.json`" passa a quatro.

A entrada do ADR-0007 **não é reescrita** — decisão aceita não se reescreve, e é regra do próprio índice. Esta decisão substitui a parte dele que previa os dois pacotes.

## Alternativas consideradas

**Mover os componentes da web para o `packages/ui`**, dando ao pacote o consumidor que ele nunca teve. Recusada por falta de problema: há **uma** superfície web, e extrair biblioteca para um consumidor só paga o custo da fronteira — build, versão, importação — sem comprar isolamento nenhum. A fronteira que existe e se paga é a do `@rally/tokens`, que é consumido pela web **e** espelhado no app Flutter: ali os dois lados precisam concordar sobre a mesma cor.

**Fazer os `tsconfig.json` estenderem o `packages/config/tsconfig.base.json`**, dando consumidor ao segundo pacote. Recusada porque **ele não serve a nenhum dos dois**, e isso é mais que repetição evitável — são dois conflitos diretos:

| O que a base declara       | `apps/api`                                                                                 | `apps/web`      |
| -------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| `strict: true`             | **não**: `strictNullChecks` sim, mas `noImplicitAny: false` e `strictBindCallApply: false` | `strict: true`  |
| `moduleResolution: "node"` | não declara (segue do `module: "commonjs"` do Nest)                                        | **`"bundler"`** |

Estender a base **apertaria** a API, que é deliberadamente mais frouxa, e **contradiria** a web na resolução de módulos. Adotá-la exigiria sobrescrever de volta as três opções num arquivo e uma no outro — e um arquivo-base cujos consumidores desfazem metade do que ele diz não é configuração compartilhada, é indireção. São dois `tsconfig.json` no repositório, não três: o `packages/tokens` não tem um, e não há raiz.

**Deixar como estava**, agora com a pendência declarada. Recusada porque declarar uma pendência não é o mesmo que resolvê-la: o ADR-0017 cumpriu seu papel ao registrar o que sabia, e deixar o registro aberto por mais um mês só manteria a documentação afirmando o que não acontece.

## Consequências

**(+)** As três afirmações falsas saem. A fronteira entre `apps/*` e `packages/*` continua existindo e passa a ter **um** habitante, que é o que de fato a atravessa.

**(+)** A pendência do ADR-0017 fecha. O `packages/` deixa de ter mais pasta morta que viva — eram duas de três.

**(−)** Quando houver segunda superfície web, ou componente que o app Flutter precise espelhar, o `packages/ui` precisa ser recriado. O histórico guarda o lugar, e o `@rally/tokens` é o molde de como fazer: pacote nasce quando o segundo consumidor aparece, não antes.

**(−)** As opções de compilador seguem declaradas em cada um dos dois `tsconfig.json`. É repetição de configuração, não de regra: ela não decide comportamento do produto, e divergir nela aparece como erro de compilação na hora, não como defeito em produção. Se um dia houver base compartilhada de verdade, ela nasce de duas configurações que **concordam** — não de um arquivo que as duas desfazem.
