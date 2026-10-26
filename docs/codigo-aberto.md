# Código Aberto, Licença e Projeções

> O Rally será **código aberto** — mas open source de produto, não de hobby. Esta nota define **licença**, **governança**, **modelo de negócio (open-core)** e as **projeções técnicas** (como o sistema escala). Decisão registrada em [Decisões de Arquitetura (ADRs)](adr/README.md) (ADR-0009). Implementação em [Arquitetura e Stack](arquitetura.md).

## 1. Posicionamento

Open source **e** produto comercial coexistem pelo modelo **open-core**: o núcleo é livre (qualquer um roda/estuda/contribui), e a sustentação do negócio vem do **serviço gerenciado (cloud)** e de **módulos enterprise**. Referência direta: o **Cal.com** (SaaS de agendamento, AGPLv3 + licença comercial para a pasta enterprise) — caso quase idêntico ao Rally.

## 2. Licença (definição)

| Parte do código                                                                              | Licença                                              | Por quê                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core** (apps/web, apps/api, apps/mobile)                                                   | **AGPL-3.0**                                         | OSI-aprovada; copyleft de rede — quem rodar como SaaS precisa abrir suas modificações. Protege contra concorrente fechar e revender.                                                                                                                                                                                                                                                                                |
| **Bibliotecas/SDK/contratos** (`packages/tokens`, SDK público)                               | **Apache-2.0**                                       | permissiva + **patent grant** — facilita terceiros integrarem sem "contaminar" o código deles.                                                                                                                                                                                                                                                                                                                      |
| **Módulos enterprise** (`/ee`, multi-unidade, SSO/SAML, SLA)                                 | **Licença Comercial** (proprietária)                 | sustenta o negócio; não faz parte do open source.                                                                                                                                                                                                                                                                                                                                                                   |
| **Documentação** (os 32 `.md`, incluindo `docs/`)                                            | **CC-BY-SA-4.0**                                     | a AGPL é escrita para programa: fala em "código-objeto" e _Corresponding Source_, que não querem dizer nada num texto. CC-BY-SA mantém o mesmo compromisso copyleft — quem adapta compartilha igual — em termos que se aplicam a prosa.                                                                                                                                                                             |
| **Ativos de interface** (os 34 `.svg` de ícone, as 7 fotos de quadra)                        | **AGPL-3.0**                                         | saíram do nosso próprio arquivo de design e só existem como parte da interface do core; seguem a licença do core. Não são marca — ver a linha abaixo.                                                                                                                                                                                                                                                               |
| **Terceiros no scaffolding** (os 10 ícones que o `flutter create` copiou para `apps/mobile`) | **BSD-3-Clause** — © The Flutter Authors             | não são nossos: são byte a byte os ícones do template do Flutter. Declará-los como nossos seria reivindicar copyright alheio.                                                                                                                                                                                                                                                                                       |
| **Fontes de terceiros** (os 4 `.woff2` em `apps/web/src/app/fonts`)                          | **OFL-1.1** — © os projetos Sora, Inter e Space Mono | as três famílias vêm do Google Fonts, sob SIL Open Font License 1.1. Estão versionadas porque o `next/font/google` as **baixava durante o build**, e uma resposta ruim do Google reprovava a CI — ver `apps/web/src/app/layout.tsx`. Mesmo caso da linha acima, não são nossas, com um dever a mais: a OFL exige que a licença viaje junto do arquivo, então o `OFL.txt` de cada família fica ao lado dos `.woff2`. |
| Conteúdo/marca (nome "Rally")                                                                | **Trademark reservado**                              | código aberto ≠ marca aberta — o nome continua protegido. Não é licença de arquivo: hoje **não existe arquivo de logo no repositório**. Quando existir, entra com uma `LicenseRef-` própria em vez de herdar a do core.                                                                                                                                                                                             |

> **Por que AGPL e não MIT/Apache no core:** MIT/Apache deixariam um concorrente pegar tudo, fechar e vender como SaaS sem devolver nada. AGPL mantém o projeto **genuinamente aberto** e impede o _free-riding_ de SaaS — o padrão de quem é OSS **e** tem produto (Cal.com, Grafana à época, Mattermost, etc.).
> **Tradeoff:** algumas empresas têm política contra AGPL no código interno — por isso os SDKs/contratos ficam em **Apache-2.0** (integração livre) e o que é sensível ao negócio fica em licença comercial.
> **Onde isso aparece no produto:** cada `package.json` declara o campo `license` com o identificador da sua linha desta tabela — AGPL na raiz, em `apps/api` e em `apps/web`; Apache em `packages/tokens`. Os quatro seguem também com `private: true`, e as duas coisas convivem: a licença diz sob que termos o código é oferecido a quem lê o repositório, e `private` diz que nada vai ao npm por acidente. No mobile o equivalente é o `publish_to: "none"` do `pubspec.yaml`. O **`SDK público`** da segunda linha ainda não existe como pacote — está na coluna "próximo salto" da seção 6.
> **Quando reconsiderar:** enquanto o repositório for privado/sem contribuidores externos, dá pra trocar a licença sem fricção. Depois de tornar público e aceitar contribuições, mudar exige concordância — então **fixar a licença antes de abrir o repo**. Para um TCC/portfólio puro (sem intenção comercial imediata), **Apache-2.0** no projeto todo é a alternativa mais simples; aqui escolhemos AGPL por já mirar produto.

## 3. Governança e higiene de OSS

Arquivos na raiz do repositório:

- `LICENSE` (AGPL-3.0) na raiz + os textos completos em `LICENSES/` — um arquivo por licença em uso (`AGPL-3.0-or-later.txt`, `Apache-2.0.txt`, `BSD-3-Clause.txt` e `CC-BY-SA-4.0.txt`) —, como o padrão **REUSE** exige + header **SPDX** por arquivo de código.
  <!-- REUSE-IgnoreStart -->
  O header é uma linha só (`SPDX-License-Identifier: AGPL-3.0-or-later`) e o copyright do repositório fica centralizado no `REUSE.toml`, em vez de repetido em cada arquivo. O que não aceita comentário (`.json`), o que é gerado (migrações do Prisma, scaffolding do Flutter) e os ativos são declarados no `REUSE.toml` e não recebem header.
  <!-- REUSE-IgnoreEnd -->
- **`reuse lint` roda na CI** (job `licenca`) e falha o build quando entra arquivo sem declaração de licença — é o item "automatizar a checagem no CI" da seção 4, agora implementado.
- `README.md` (o que é, como rodar, screenshots), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant), `SECURITY.md` (canal de disclosure responsável — ver [Segurança, Privacidade e LGPD](seguranca-lgpd.md)).
- **DCO** (Developer Certificate of Origin — `Signed-off-by`) em vez de CLA: mais leve e suficiente para começar.
- `.github/`: templates de **issue** e **pull request**, **CODEOWNERS**, workflows de CI.
- **Releases semânticos** (SemVer) + `CHANGELOG.md` gerado (changesets) + **roadmap público** (GitHub Projects) — alimenta comunidade e portfólio.
- `NOTICE`/`THIRD_PARTY` com atribuições de dependências.

## 4. Conformidade de licenças de dependências

- AGPL/Apache no nosso código **podem consumir** dependências MIT/BSD/Apache/ISC sem problema.
- **Evitar** trazer libs com copyleft incompatível para dentro de pacotes Apache.
- **Automatizar a checagem** no CI: `license-checker`/`pnpm licenses`, **FOSSA** ou o padrão **REUSE** (`reuse lint`) — falha o build se entrar licença proibida.
- Manter inventário **SBOM** (CycloneDX) para auditoria e segurança da cadeia de suprimentos.

## 5. Modelo de negócio (open-core)

| Edição                    | O que é                                                                 | Monetização                               |
| ------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| **Community** (self-host) | core AGPL completo: agendamento, gestão, pagamentos, replays básicos    | grátis — adoção, comunidade, portfólio    |
| **Rally Cloud**           | mesmo produto **gerenciado** (sem dor de infra), atualizações, backups  | **assinatura** (SaaS) — principal receita |
| **Enterprise**            | multi-unidade/rede de quadras, SSO/SAML, papéis avançados, SLA, suporte | **licença/contrato**                      |

> O open source vira **funil**: dono experimenta self-host → migra pro Cloud pela conveniência → cresce pro Enterprise. Conecta com Visão e Posicionamento e Roadmap.

## 6. Projeções técnicas (como escala — "overengineering" planejado)

Decisões de hoje já deixam a porta aberta para cada salto:

| Frente          | Hoje (desde o início)          | Próximo salto                                    | Escala máxima                                                    |
| --------------- | ------------------------------ | ------------------------------------------------ | ---------------------------------------------------------------- |
| Compute         | ECS Fargate + ALB              | autoscaling por métrica                          | **EKS (Kubernetes)** / service mesh                              |
| Banco           | RDS PostgreSQL Multi-AZ        | **read replicas** + PgBouncer                    | particionamento/**sharding por tenant**, Aurora                  |
| Filas/eventos   | Redis + BullMQ                 | tópicos dedicados                                | **Kafka/Kinesis** (event streaming)                              |
| Busca           | Postgres Full-Text Search      | índices dedicados                                | **OpenSearch/Elasticsearch**                                     |
| Analytics       | views SQL + Recharts           | **ETL → data warehouse** (Redshift)              | lakehouse + BI                                                   |
| Mídia/replays   | S3 + MediaConvert + CloudFront | **IVS** (ao vivo)                                | pipeline de **IA: highlights automáticos** (visão computacional) |
| IA/ML           | —                              | recomendação de horário, previsão de **no-show** | **preço dinâmico**, detecção de lances                           |
| Disponibilidade | Multi-AZ                       | **multi-região** + DR                            | ativo-ativo                                                      |
| Plataforma      | API REST + webhooks            | **API pública + SDK**                            | marketplace de integrações                                       |
| Observabilidade | CloudWatch + Sentry + OTel     | **Grafana/Prometheus**                           | tracing distribuído completo                                     |

## 7. Projeção de produto (resumo)

Quadras de areia → **clubes esportivos** (jogadores, times, mensalidades, aulas) → **rede/marketplace** de quadras com descoberta e replays como diferencial. Detalhe e fases em Roadmap.

> Conexões: stack em [Arquitetura e Stack](arquitetura.md) · teoria em [Fundamentação Teórica e Padrões](fundamentacao.md) · segurança/LGPD em [Segurança, Privacidade e LGPD](seguranca-lgpd.md) · decisões em [Decisões de Arquitetura (ADRs)](adr/README.md).
