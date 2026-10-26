# ADR-0015 — Playwright como condutor de navegador para as capturas

**Status:** Aceito · **Data:** 2026-10-19

## Contexto

As figuras 7 a 9 do Relatório são capturas de tela geradas por script, e não prints manuais. A razão está no próprio script: **print tirado à mão não se reproduz** — muda de tamanho, pega barra de navegador, envelhece sem ninguém notar e não volta igual quando a interface muda. Declarar largura, altura e rota transforma "atualizar as figuras" em rodar um comando.

O script fazia isso chamando o **Chrome do sistema** pela linha de comando, com `--headless --screenshot`. Funciona para rota pública, e não funciona para rota atrás de login: `--screenshot` não manda cookie nem preenche formulário.

Por isso quatro telas ficaram listadas como pendência — o painel do dono, a agenda, os mensalistas e a trilha de auditoria. **São justamente as que a pesquisa de campo pediu:** autoatendimento e agenda visual foram os recursos mais marcados pelos dez gestores, e o controle de mensalistas foi marcado por cinco. Ilustrar o trabalho sem elas deixaria de fora o que o dado apontou como essencial.

## Decisão

As capturas passam a ser feitas pelo **Playwright**, que conduz um Chromium próprio: navega, preenche o formulário de entrada, espera a página assentar e salva o PNG.

O script antigo do vault **é substituído, não complementado**. O docstring dele dizia, sobre reusar o Chrome que o pipeline ABNT localiza, que _"dois lugares procurando o navegador seriam duas verdades, e a que não fosse exercitada quebraria calada"_. Manter o Chrome por linha de comando para três rotas e o Playwright para quatro criaria exatamente isso. Uma ferramenta, um navegador, uma lista de telas.

Três decisões de desenho dentro do script:

- **O identificador do estabelecimento não é fixado.** O login chega em `/gestao`, que redireciona para o primeiro estabelecimento do usuário; o script lê a URL resultante. Fixar o id faria a captura quebrar quando o _seed_ mudasse de identificador.
- **As credenciais vêm do `prisma/seed.ts`**, que é onde elas são declaradas. Repetir o valor no script criaria a segunda cópia de uma verdade.
- **Captura abaixo de um tamanho mínimo é falha.** Página ainda compilando sai em branco, e um PNG branco não dá erro — vira figura vazia no PDF e ninguém vê até a defesa. O script antigo só checava se o arquivo existia; este cobra o tamanho e diz qual arquivo, com quantos bytes e por quê.

## Alternativas consideradas

**Prints manuais.** Recusada pela mesma razão que levou ao script em primeiro lugar. O projeto já tomou essa decisão para os gráficos da pesquisa e não há motivo para inverter aqui.

**Protocolo do DevTools na mão.** Seria possível abrir o Chrome com `--remote-debugging-port`, injetar o cookie com `Network.setCookie` e capturar com `Page.captureScreenshot`, sem dependência nova. Recusada: o protocolo trafega por WebSocket, a biblioteca padrão do Python não tem cliente, e o resultado seria **automação de navegador caseira** — mantida por nós, exercitada por um único script, quebrando calada quando o protocolo mudasse.

**Deixar as quatro telas fora do Relatório, com a ausência declarada.** Declarar um limite é legítimo quando não há correção possível; aqui havia, e o projeto já aprendeu que _furo declarado é furo que continua furo_.

**Mover também a impressão do PDF para o Playwright.** Considerada e **adiada**. Unificaria os dois usos de navegador, mas o pipeline ABNT está provado e mexer nele para ganhar simetria trocaria risco por elegância. Fica registrado que o projeto tem dois navegadores por motivos diferentes: o Chrome do sistema imprime o PDF, o Chromium do Playwright captura as telas.

## Consequências

**(+)** A figura regerada em outra máquina sai do **mesmo motor**, porque a versão do Chromium vem da versão do Playwright, que o `package.json` fixa. Antes dependia do Chrome que a máquina tivesse.

**(+)** Abre o caminho para **teste de ponta a ponta**, que o projeto não tem. O download do navegador é a parte cara e já está paga; acrescentar o `@playwright/test` por cima é passo pequeno. Isto **não** é entregue aqui — está dito como consequência, não como feito.

**(−)** Uma dependência de desenvolvimento a mais e um navegador baixado no ambiente (~130 MB). Fica na raiz da _workspace_, como o husky e o commitlint, porque é ferramenta de repositório e não do aplicativo web.

**(−)** Se um dia a CI rodar as capturas, precisará de `npx playwright install chromium` no fluxo. Hoje não roda: as figuras são geradas localmente e versionadas no vault, junto do Relatório que as usa.

## O que esta decisão não resolve

**As capturas das telas de gestão continuam precisando de Postgres com dado semeado**, e isso é outro bloqueio: o Docker não está instalado na máquina de desenvolvimento, e o PostgreSQL local tem o papel `rally` com senha diferente da que o `.env.example` documenta. O Playwright resolve o login; não resolve o banco.
