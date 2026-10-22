# ADR-0016 — Overrides do pnpm para vulnerabilidade transitiva

**Status:** Aceito · **Data:** 2026-10-22

## Contexto

O repositório acumulava **15 alertas de segurança** abertos. Nenhum deles é vulnerabilidade de dependência que o projeto declara: todas entram **transitivamente**, puxadas por pacote que o `package.json` pede. O `handlebars` vem do `ts-jest`; o `source-map-js` e o `postcss` vêm da cadeia de build da web; o `sprintf-js` vem do `jest`; o `deepmerge-ts` vem do `@prisma/config`; o `vite` vem do `vitest`; o `uuid` vem do `exceljs`.

Isso muda a pergunta. Não é "atualizar a dependência", porque a dependência direta já está na última versão — é **alcançar uma versão que o projeto não escolheu**.

A segunda pergunta é qual alerta importa. "Severidade crítica" não diz se o código vulnerável roda em produção, e tratar os 15 como iguais gastaria o mesmo esforço num compilador de template que só existe dentro do executor de testes e numa biblioteca que a API carrega para gerar planilha. O alcance foi **estabelecido com `pnpm why -r`**, pacote por pacote, e não estimado:

| Pacote | Origem | Alcança produção |
| --- | --- | --- |
| `handlebars` | `ts-jest` | não |
| `vite` | `vitest` | não |
| `postcss-selector-parser` | `postcss-nested` | não |
| `sprintf-js` | `jest` | não |
| `postcss`, `source-map-js` | cadeia de build da web | em tempo de build |
| `deepmerge-ts` | `@prisma/client` → `@prisma/config` | não em tempo de execução |
| **`uuid`** | **`exceljs`, dependência de produção** | **sim** |

Um só dos 15 alcança a API em execução.

## Decisão

As versões vulneráveis são elevadas por **`pnpm.overrides` na raiz**, com faixa de piso (`>=`), e não por atualização de dependência direta. O override é a ferramenta certa aqui porque o pacote vulnerável **não é declarado em lugar nenhum** do repositório: não há manifesto para editar.

Três achados dessa aplicação ficam registrados, porque cada um deles custaria a próxima pessoa um diagnóstico.

**Override que o pnpm não alcança falha calado.** O `vite` existe apenas como *peer* do `vitest` e do `@vitejs/plugin-react` — ninguém depende dele, o pnpm o instala automaticamente para satisfazer o peer. O override `>=8.3.3` **não o moveu**: o `pnpm install` terminou com sucesso, imprimiu `unmet peer vite@>=8.3.3: found 8.3.1` como aviso, e deixou a versão vulnerável no lockfile. Aviso não falha instalação, e três alertas continuariam abertos com o override parecendo aplicado. A correção não é insistir no override: é **declarar o `vite` como dependência de desenvolvimento do `apps/web`**, que é onde o `vitest` roda. Peer auto-instalado é dependência que ninguém assumiu, e o preço de não assumir é não poder controlar.

**A versão mais nova não é a versão certa.** O alerta do `uuid` é corrigido em 11.1.1, e `>=11.1.1` resolveu para **14.0.3** — que é ESM puro: `"type": "module"`, sem condição `require` no mapa de exportações. O `exceljs` é CommonJS e o carrega com `require('uuid').v4`. Verificado isolado no Node 22, **funcionou**, porque o Node passou a aceitar `require` de módulo ESM. Verificado sob o Jest, **não**: a suíte `relatorios.service.spec.ts` inteira parou de carregar, 0 testes executados. Por isso a faixa é `^11.1.1`, e não `>=11.1.1`: a **11.1.1 é a última linha que ainda publica build CJS**. O piso vem do alerta; o teto vem do que o consumidor consegue carregar.

**Um alerta não tem correção publicada.** O `sprintf-js` é vulnerável em toda versão até 1.1.3 e não há versão corrigida. Ele chega pelo `jest` e não vai a produção. Fica **declarado aqui**, não escondido: alerta sem correção é alerta que continua aberto, e o projeto já decidiu que *furo declarado é furo que continua furo* — a diferença é que este não tem conserto disponível para ser recusado.

## Alternativas consideradas

**Atualizar a dependência direta que carrega cada uma.** Recusada pelo tamanho da alavanca: mover o `postcss` pela via do `next` seria atualizar o framework da web para corrigir uma dependência de tempo de build. O override atinge o pacote exato.

**`pnpm audit --fix`.** Escreveria overrides parecidos sem estabelecer alcance. O projeto quer o alcance **escrito**, porque é ele que justifica o esforço desigual entre um alerta crítico de desenvolvimento e um médio de produção.

**Ignorar os alertas que não vão a produção.** Recusada. Dependência de desenvolvimento executa na máquina de quem mantém o projeto e na CI, que tem credencial do repositório. Não ir a produção reduz a gravidade; não a zera.

**Esperar os PRs do Dependabot.** Eles atualizam dependência declarada, uma por vez, e **não alcançam versão transitiva fixada** por um pacote intermediário. Os dez PRs de junho abertos no repositório são prova de que esperar não resolve.

## Consequências

**(+)** 14 dos 15 alertas são fechados por sete linhas de override e uma dependência declarada. Cada pacote colapsou para **uma única versão** no lockfile; antes o `handlebars`, o `postcss`, o `source-map-js` e o `postcss-selector-parser` apareciam em mais de uma, e a instalação carregava a vulnerável ao lado da corrigida.

**(+)** O único que alcança produção foi verificado pela suíte que de fato escreve planilha, e não pela leitura do changelog — e foi ela que recusou a versão 14.

**(−)** Override é **piso que o projeto passa a manter**. Quando uma dependência legitimamente precisar de versão anterior, a instalação vai acusar conflito em vez de resolver, e a lista terá de ser revisitada. Ela não é definitiva: cada linha existe enquanto o pacote intermediário não subir por conta própria.

**(−)** O override é **invisível no manifesto de quem consome**. Quem lê `apps/web/package.json` não descobre ali que o `postcss` tem piso em 8.5.30. Por isso a faixa declarada do `postcss` naquele arquivo também subiu para `^8.5.30`: o manifesto deixa de anunciar faixa que inclui versão vulnerável, mesmo que o override já a impedisse.

**(−)** O `sprintf-js` segue aberto até que haja correção publicada.
