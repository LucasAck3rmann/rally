# Decisões de Arquitetura (ADRs)

> **ADR = Architecture Decision Record.** Cada decisão relevante é registrada com _contexto → decisão → alternativas → consequências_, para que a escolha seja **rastreável** (e defensável na banca). No repositório, vira um arquivo por ADR em `docs/adr/NNNN-*.md`. Resumo da stack em [Arquitetura e Stack](../arquitetura.md).

**Status possíveis:** Proposto · **Aceito** · Substituído · Depreciado.

---

## ADR-0001 — NestJS como framework de back-end

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Precisamos de uma API robusta, testável e organizada por domínio, com TypeScript, para servir web e mobile.
**Decisão:** Usar **NestJS** (Node + TS) com arquitetura modular (controller→service→repository), DI nativa e OpenAPI.
**Alternativas:** Next.js API routes (acoplaria back ao front, sem estrutura); Express/Fastify puro (flexível, mas sem padrão imposto — vira bagunça); Django/Spring (fora do ecossistema TS do monorepo).
**Consequências:** (+) modularidade, testabilidade, DI, documentação Swagger, padrão de mercado. (−) curva de aprendizado e verbosidade (decorators/DTOs) — aceitável pelo ganho de organização.

## ADR-0002 — Flutter no aplicativo mobile

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Queremos **um app nativo** para iOS e Android com uma base de código, boa performance e UI fiel ao design system.
**Decisão:** **Flutter (Dart 3)** com Riverpod, go_router e Dio (clean architecture).
**Alternativas:** React Native (compartilharia TS/React com a web, mas com mais fricção nativa e fragmentação de libs); PWA (não atende câmera de replay/push nativo a contento); nativo duplo Kotlin+Swift (custo 2×).
**Consequências:** (+) UI consistente, performance, 1 base p/ 2 plataformas, ótimo p/ recursos de câmera (replays). (−) Dart fora do stack TS (mas tokens vêm do mesmo Style Dictionary); time precisa aprender Dart.

## ADR-0003 — AbacatePay como gateway de pagamento

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O público é brasileiro e o **Pix** é o meio dominante; precisamos de cobrança simples com webhook confiável.
**Decisão:** **AbacatePay** como gateway principal (Pix + cartão), confirmação por **webhook assinado** e idempotência.
**Alternativas:** Stripe (excelente DX, mas Pix limitado e foco internacional); Mercado Pago/Asaas/Pagar.me (válidos — ficam como fallback).
**Consequências:** (+) Pix nativo BR, simplicidade, custo. (−) menos maduro que Stripe e menos material — mitigado por isolar o gateway atrás de um **Adapter** (troca sem mexer no domínio).

## ADR-0004 — PostgreSQL + Prisma

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O domínio (reservas, pagamentos, relações) é fortemente **relacional** e exige integridade e concorrência.
**Decisão:** **PostgreSQL** como banco e **Prisma** como ORM/migrations (tipado, integra com TS do monorepo).
**Alternativas:** MySQL (ok, menos recursos que PG); MongoDB (modelo de documento não combina com reservas/transações); ORMs TypeORM/Drizzle (Prisma vence em DX e migrations).
**Consequências:** (+) integridade, transações, full-text search nativo, tipos ponta a ponta. (−) Prisma abstrai SQL avançado — quando preciso, usar query raw/SQL.

## ADR-0005 — AWS como cloud + Cloudflare na borda (desde o início)

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O projeto mira escala e robustez **desde já** (decisão do produto), com infra reproduzível e padrão de mercado.
**Decisão:** **AWS** (ECS Fargate, RDS, ElastiCache, S3, CloudFront, SES, CloudWatch, Secrets Manager) provisionada por **Terraform**, com **Cloudflare** na frente (DNS, CDN, WAF, registrar). AWS **desde o dia 1**, sem etapa intermediária.
**Alternativas:** Supabase/Render/Railway + Cloudflare R2 (mais rápido de começar, mas teria migração depois — rejeitado pelo requisito "AWS desde o início"); GCP/Azure (equivalentes — AWS escolhida por maturidade/ecossistema/mercado).
**Consequências:** (+) escala, HA, padrão de mercado, currículo. (−) mais complexo e caro no início que um PaaS — mitigado por **dev local em Docker Compose** e IaC versionada.

## ADR-0006 — Replays em S3 + MediaConvert + CloudFront

**Status:** **Substituído** pelo [ADR-0012](0012-replays-por-parceria.md) · **Data:** 2026-06-16
**Contexto:** Replays exigem armazenar, **transcodificar** e entregar vídeo com escala — diferencial do produto.
**Decisão:** Upload → **S3**; transcode VOD → **MediaConvert**; entrega → **CloudFront** (URLs assinadas). **IVS** para ao vivo no futuro.
**Alternativas:** **Mux** (DX excelente — vira alternativa gerenciada se o pipeline AWS pesar); Cloudinary (foco imagem).
**Consequências:** (+) tudo AWS-native, controle e custo a escala. (−) mais peças para orquestrar que um SaaS de vídeo pronto — isolar atrás de serviço de mídia.

> **Por que caiu:** a pesquisa de mercado de 02/09/2026 mostrou que replay automático já é vertical madura no Brasil (FilmaEu e outros). Construir a captação viraria concorrência direta em hardware e visão computacional. Ver [ADR-0012](0012-replays-por-parceria.md).

## ADR-0007 — Monorepo com Turborepo

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Web, API e pacotes compartilham tipos/contratos/tokens; queremos consistência e build eficiente.
**Decisão:** **Turborepo + pnpm**; Flutter como app próprio dentro do repo. `packages/shared` (Zod/contratos), `packages/ui`, `packages/tokens`.
**Alternativas:** Polyrepo (divergência de contratos, mais overhead); **Nx** (mais poderoso/pesado — Turborepo é mais simples e suficiente).
**Consequências:** (+) contrato único, refactor atômico, cache de build. (−) repo maior e tooling de monorepo a manter.

## ADR-0008 — Conventional Commits + Trunk-based Development

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Histórico legível, releases automatizáveis e fluxo simples para um time pequeno.
**Decisão:** **Conventional Commits** (validado por commitlint + Husky), **SemVer** + changesets, e **trunk-based**/GitHub Flow (branches curtas + PR + review).
**Alternativas:** Gitflow (cerimônia demais p/ entrega contínua); commits livres (histórico ruim, sem automação).
**Consequências:** (+) changelog/release automáticos, PRs pequenos, CI/CD fluido. (−) exige disciplina — garantida por hooks no CI.

## ADR-0009 — Licença AGPL-3.0 (open-core)

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** O Rally será **código aberto** e, ao mesmo tempo, um **produto** comercial.
**Decisão:** **AGPL-3.0** no core; **Apache-2.0** nos SDKs/contratos/tokens; **licença comercial** nos módulos enterprise (open-core). Detalhe em [Código Aberto, Licença e Projeções](../codigo-aberto.md).
**Alternativas:** MIT/Apache no projeto todo (permissivo, mas deixa concorrente fechar e revender — _free-riding_); BSL (source-available, não é OSI). Precedente: **Cal.com** (AGPL + comercial).
**Consequências:** (+) projeto genuinamente aberto e protegido contra SaaS fechado; modelo de negócio sustentável. (−) algumas empresas evitam AGPL — mitigado pelos SDKs em Apache. **Fixar antes de tornar o repo público.**
**Complemento (2026-10-15):** a decisão acima cobria só código. Dois casos que ela não previa foram resolvidos na tabela da seção 2 de [Código Aberto, Licença e Projeções](../codigo-aberto.md): **documentação em CC-BY-SA-4.0** (a AGPL é escrita para programa, não para prosa) e **ativos de terceiros sob a licença de origem** — os ícones vindos do template do Flutter são BSD-3-Clause, e não nossos.

## ADR-0010 — Deploy AWS-native (SST/OpenNext + ECS Fargate)

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** Manter tudo na AWS (decisão do ADR-0005), inclusive o front Next.js, sem depender de Vercel.
**Decisão:** Web (Next.js) via **SST/OpenNext** (Lambda + CloudFront + S3); API/workers em **ECS Fargate** (imagens no **ECR**); deploy pelo **GitHub Actions** com migrations Prisma como gate.
**Alternativas:** Vercel (melhor DX p/ Next, mas foge do "tudo AWS"); AWS Amplify (mais fechado); **EKS** (Kubernetes — overkill agora, fica como salto de escala futuro).
**Consequências:** (+) stack 100% AWS, custo previsível, IaC única. (−) deploy de Next serverless na AWS é mais trabalhoso que Vercel — aceito pelo requisito de AWS desde o início.

## ADR-0011 — Estratégia de multi-tenancy

**Status:** Aceito · **Data:** 2026-06-16
**Contexto:** SaaS com muitos estabelecimentos no mesmo app; isolamento entre tenants é requisito de segurança (RN-16).
**Decisão (resumo):** banco/schema **compartilhados** com isolamento por `estabelecimentoId` aplicado de forma **centralizada** (app-level via Prisma), com **RLS do Postgres** como defesa em profundidade futura; schema/banco-por-tenant só no **enterprise**.
**Consequências:** (+) simples, nativo no Prisma, barato, entrega o MVP; caminho de endurecimento mapeado. (−) depende de escopo centralizado e testes de isolamento — risco de IDOR mitigado.
**Versão por extenso:** [ADR-0011 — Estratégia Multi-tenant](0011-multi-tenant.md).

## ADR-0012 — Captação de replays por parceria

**Status:** Aceito · **Data:** 2026-09-02 · **Substitui o [ADR-0006](#adr-0006--replays-em-s3--mediaconvert--cloudfront)**
**Contexto:** A premissa de que replay automático era inédito caiu: a pesquisa de mercado mapeou uma vertical madura (FilmaEu, com 4.000+ quadras, e outras seis), separada e **complementar** à vertical de agendamento — nenhum sistema de agenda produz vídeo, e nenhum sistema de vídeo agenda.
**Decisão (resumo):** a captação **não é construída internamente** — vem por parceria, com o fornecedor entrando como **adaptador atrás de uma porta**, como já é feito com o Pix. O diferencial passa a ser arquitetural: `Replay` é entidade do domínio ligada a `Reserva` e `Usuario`, então só o Rally sabe qual clipe é de quem.
**Consequências:** (+) sai da disputa em hardware e visão computacional; o vínculo reserva↔clipe fica no domínio e o fornecedor é substituível. (−) a FilmaEu não tem API pública documentada — **risco declarado**: a integração depende de interface que eles forneçam.
**Versão por extenso:** [ADR-0012 — Captação de replays por parceria](0012-replays-por-parceria.md).

## ADR-0013 — Conciliação interna, sem extrato do gateway

**Status:** Aceito · **Data:** 2026-10-14
**Contexto:** O relatório de conciliação (RF-29) compara reserva e cobrança para achar divergência — Pix expirado que ainda ocupa horário, reserva confirmada sem pagamento, valor divergente. A comparação ideal seria contra o **extrato do gateway**, que é a fonte externa, mas o projeto não tem credencial da AbacatePay (ADR-0003) e não terá antes do M5.
**Decisão:** conciliar **dentro do Rally**, comparando a `Reserva` com o `Pagamento` que o próprio sistema gravou, e **declarar o limite na tela e no código** em vez de sugerir uma conferência externa que não acontece.
**Alternativas:** esperar a credencial e não entregar conciliação nenhuma (deixaria o gestor sem o relatório que ele mais usa para fechar o caixa); importar extrato por CSV manual (acrescenta trabalho de digitação ao problema que o sistema existe para remover).
**Consequências:** (+) acha as seis divergências que nascem dentro do sistema, que são as que o gestor resolve sozinho; a porta para o extrato continua aberta e é um adaptador. (−) **não acha divergência que só o extrato revelaria** — pagamento que entrou no gateway e não chegou ao Rally, por exemplo —, e isso está escrito na própria tela de conciliação.
**Nota:** este ADR já era citado em três pontos do código (`conciliacao.service.ts`, `conciliacao.tsx` e o teste da tela) **antes de existir**. Foi escrito em 17/10 para fechar a referência pendente; o conteúdo é a decisão que o código já implementava.

## ADR-0014 — Mensalistas como reservas materializadas

**Status:** Aceito · **Data:** 2026-10-17 · **Requisito:** [RF-36](../requisitos.md)
**Contexto:** Cinco dos dez gestores da pesquisa de campo marcaram **controle de mensalistas** como recurso indispensável, e é o único da lista que o sistema não entrega de forma alguma. Um deles escreveu, no campo livre, _"campo com os mensalistas"_.
**Decisão (resumo):** a série recorrente **materializa reservas reais** no banco, por horizonte deslizante, em vez de ser ocupação calculada na leitura. Colisão com reserva existente **pula a semana e reporta**, sem recusar a série nem deslocar ninguém.
**Alternativas:** ocupação virtual (recusada — a restrição de exclusão `reserva_sem_sobreposicao` protege **linhas que existem**, e um mensalista sem linha poderia ser reservado por cima, devolvendo à aplicação a verificação que o projeto tirou dela de propósito); recusar a série inteira na colisão; deslocar a reserva conflitante.
**Consequências:** (+) a ocorrência é reserva comum — entra na agenda, no relatório, na conciliação e sob a trava do banco, sem que nenhum desses caminhos precise conhecer mensalista. (−) horizonte é estado que envelhece, e a mitigação tem de ser **medida** e não intenção: a série guarda até quando foi materializada, o painel mostra a folga e um trabalho diário estende o horizonte — medida e manutenção são coisas diferentes, e por um dia só a medida existiu. (−) a série **não se altera**: trocar quadra, dia ou hora é encerrar e cadastrar outra, e nenhum DTO de edição aceita esses campos — o preço disso é um cadastro a mais, e o ganho é que nenhuma reserva pode discordar da série que a gerou.
**Versão por extenso:** [ADR-0014 — Mensalistas como reservas materializadas](0014-mensalistas.md).

## ADR-0015 — Playwright como condutor de navegador para as capturas

**Status:** Aceito · **Data:** 2026-10-19
**Contexto:** As figuras do sistema são capturas geradas por script, porque print manual não se reproduz. O script chamava o Chrome do sistema com `--headless --screenshot`, que **não manda cookie nem preenche formulário** — e por isso quatro telas de gestão ficaram como pendência, justamente as que a pesquisa apontou como essenciais.
**Decisão (resumo):** as capturas passam ao **Playwright**, que faz o login e salva o PNG. O script antigo é **substituído, não complementado**: mantê-lo criaria dois lugares procurando o navegador, que é o que o próprio docstring dele mandava evitar.
**Alternativas:** prints manuais (recusada — o projeto já decidiu isso para os gráficos); protocolo do DevTools na mão (recusada — viraria automação de navegador caseira, mantida por nós e exercitada por um script só); deixar as telas fora do Relatório (recusada — _furo declarado é furo que continua furo_); mover também a impressão do PDF (adiada — o pipeline ABNT está provado).
**Consequências:** (+) a figura regerada em outra máquina sai do mesmo motor, porque a versão do navegador vem do `package.json`; (+) abre caminho para teste de ponta a ponta, que o projeto não tem — dito como consequência, não como feito. (−) uma dependência de desenvolvimento e um navegador baixado; (−) o projeto passa a ter **dois navegadores**, por motivos diferentes: o Chrome do sistema imprime o PDF, o Chromium do Playwright captura as telas.
**Versão por extenso:** [ADR-0015 — Playwright como condutor de navegador para as capturas](0015-playwright-para-capturas.md).

## ADR-0016 — Overrides do pnpm para vulnerabilidade transitiva

**Status:** Aceito · **Data:** 2026-10-22
**Contexto:** 15 alertas de segurança abertos, **nenhum** em dependência que o projeto declara — todos entram transitivamente. O alcance de cada um foi estabelecido com `pnpm why -r`, e só **um** chega à API em execução: o `uuid`, pelo `exceljs`.
**Decisão (resumo):** elevar as versões por **`pnpm.overrides` na raiz**, com faixa de piso, porque o pacote vulnerável não é declarado em manifesto nenhum. Mais uma dependência assumida de verdade: o `vite` passa a ser dependência de desenvolvimento do `apps/web`, já que **override não alcança peer auto-instalado** — o `pnpm install` terminava com sucesso, imprimia `unmet peer` como aviso e deixava a versão vulnerável no lockfile.
**Alternativas:** atualizar a dependência direta que carrega cada uma (recusada — mover o `postcss` pela via do `next` seria atualizar o framework para corrigir dependência de build); `pnpm audit --fix` (escreveria o mesmo sem estabelecer alcance, e é o alcance que justifica o esforço desigual); ignorar o que não vai a produção (recusada — dependência de desenvolvimento roda na CI, que tem credencial); esperar os PRs do Dependabot (não alcançam versão transitiva fixada).
**Consequências:** (+) 14 dos 15 fechados, e cada pacote colapsou para **uma única versão** no lockfile; (+) o único que alcança produção foi verificado pela suíte que escreve planilha — e foi ela que recusou o `uuid` 14, ESM puro, que o Node 22 carrega e o Jest não. (−) override é **piso que o projeto passa a manter**, e a lista tem de ser revisitada quando o pacote intermediário subir sozinho; (−) é invisível no manifesto de quem consome, mitigado subindo também a faixa declarada do `postcss`; (−) o `sprintf-js` **continua instalado** e sem correção publicada, embora o GitHub tenha fechado o alerta dele junto com os outros ao reresolver a árvore — **alerta fechado não é dependência removida**, e a conferência que vale é o lockfile.
**Versão por extenso:** [ADR-0016 — Overrides do pnpm para vulnerabilidade transitiva](0016-overrides-para-vulnerabilidade-transitiva.md).

## ADR-0017 — Remoção do `packages/shared`

**Status:** Aceito · **Data:** 2026-10-25 · **Substitui parcialmente:** ADR-0007
**Contexto:** O ADR-0007 nomeou o `packages/shared` como contrato único entre as superfícies. Quatro meses depois ele tinha um esquema — a validação da criação de reserva — e **nenhum consumidor**: nenhum `package.json` o declarava e nenhum arquivo o importava. O que aconteceu foi o contrário do previsto: a API valida a entrada com DTOs do `class-validator` e a web valida a resposta com Zod próprio, e nenhuma das duas teve motivo para importar o pacote.
**Decisão (resumo):** remover o pacote e **corrigir a documentação que o descrevia em uso** — o `governanca.md` afirmava que "web/mobile consomem contratos de `packages/shared`", e isso nunca foi verdade. A entrada do ADR-0007 não é reescrita: decisão aceita não se reescreve, e o registro de que o contrato único foi tentado tem valor próprio.
**Alternativas:** ligar a web ao pacote (recusada — esquema que o servidor não executa não é contrato, é uma segunda opinião que ninguém força a concordar); deixar como estava (recusada — aparecia na documentação como se estivesse em uso, entrava na tabela de licenças e convidava alguém a importá-lo achando que era a fonte de verdade); gerar o contrato do **OpenAPI** (é o caminho preferido, e não depende deste pacote).
**Consequências:** (+) some uma segunda fonte de verdade nunca exercitada, e com ela uma dependência de `zod` num pacote morto; (+) a documentação passa a descrever o que o repositório faz, citando o `@rally/tokens`, que é consumido por 22 arquivos. (−) contrato compartilhado de verdade exigiria recriar o pacote; (−) `packages/ui` e `packages/config` seguem sem consumidor pela mesma medição, e ficam **declarados** como pendência.
**Versão por extenso:** [ADR-0017 — Remoção do `packages/shared`](0017-remocao-do-pacote-compartilhado.md).

---

> Próximos ADRs conforme o código evoluir (ex.: busca OpenSearch, event streaming Kafka, IA nos replays). Cada novo ADR recebe o próximo número e nunca se reescreve um aceito — cria-se um que o **substitui**.
