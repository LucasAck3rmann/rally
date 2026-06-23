# Código Aberto, Licença e Projeções

> O Rally será **código aberto** — mas open source de produto, não de hobby. Esta nota define **licença**, **governança**, **modelo de negócio (open-core)** e as **projeções técnicas** (como o sistema escala). Decisão registrada em [Decisões de Arquitetura (ADRs)](adr/README.md) (ADR-0009). Implementação em [Arquitetura e Stack](arquitetura.md).

## 1. Posicionamento
Open source **e** produto comercial coexistem pelo modelo **open-core**: o núcleo é livre (qualquer um roda/estuda/contribui), e a sustentação do negócio vem do **serviço gerenciado (cloud)** e de **módulos enterprise**. Referência direta: o **Cal.com** (SaaS de agendamento, AGPLv3 + licença comercial para a pasta enterprise) — caso quase idêntico ao Rally.

## 2. Licença (definição)
| Parte do código | Licença | Por quê |
|---|---|---|
| **Core** (apps/web, apps/api, apps/mobile) | **AGPL-3.0** | OSI-aprovada; copyleft de rede — quem rodar como SaaS precisa abrir suas modificações. Protege contra concorrente fechar e revender. |
| **Bibliotecas/SDK/contratos** (`packages/shared`, `packages/tokens`, SDK público) | **Apache-2.0** | permissiva + **patent grant** — facilita terceiros integrarem sem "contaminar" o código deles. |
| **Módulos enterprise** (`/ee`, multi-unidade, SSO/SAML, SLA) | **Licença Comercial** (proprietária) | sustenta o negócio; não faz parte do open source. |
| Conteúdo/marca (nome "Rally", logo) | **Trademark reservado** | código aberto ≠ marca aberta — o nome continua protegido. |

> **Por que AGPL e não MIT/Apache no core:** MIT/Apache deixariam um concorrente pegar tudo, fechar e vender como SaaS sem devolver nada. AGPL mantém o projeto **genuinamente aberto** e impede o *free-riding* de SaaS — o padrão de quem é OSS **e** tem produto (Cal.com, Grafana à época, Mattermost, etc.).
> **Tradeoff:** algumas empresas têm política contra AGPL no código interno — por isso os SDKs/contratos ficam em **Apache-2.0** (integração livre) e o que é sensível ao negócio fica em licença comercial.
> **Quando reconsiderar:** enquanto o repositório for privado/sem contribuidores externos, dá pra trocar a licença sem fricção. Depois de tornar público e aceitar contribuições, mudar exige concordância — então **fixar a licença antes de abrir o repo**. Para um TCC/portfólio puro (sem intenção comercial imediata), **Apache-2.0** no projeto todo é a alternativa mais simples; aqui escolhemos AGPL por já mirar produto.

## 3. Governança e higiene de OSS
Arquivos na raiz do repositório:
- `LICENSE` (AGPL-3.0) + `LICENSE-APACHE` nos pacotes + headers **SPDX** (`SPDX-License-Identifier: AGPL-3.0-or-later`) por arquivo.
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
| Edição | O que é | Monetização |
|---|---|---|
| **Community** (self-host) | core AGPL completo: agendamento, gestão, pagamentos, replays básicos | grátis — adoção, comunidade, portfólio |
| **Rally Cloud** | mesmo produto **gerenciado** (sem dor de infra), atualizações, backups | **assinatura** (SaaS) — principal receita |
| **Enterprise** | multi-unidade/rede de quadras, SSO/SAML, papéis avançados, SLA, suporte | **licença/contrato** |
> O open source vira **funil**: dono experimenta self-host → migra pro Cloud pela conveniência → cresce pro Enterprise. Conecta com Visão e Posicionamento e Roadmap.

## 6. Projeções técnicas (como escala — "overengineering" planejado)
Decisões de hoje já deixam a porta aberta para cada salto:
| Frente | Hoje (desde o início) | Próximo salto | Escala máxima |
|---|---|---|---|
| Compute | ECS Fargate + ALB | autoscaling por métrica | **EKS (Kubernetes)** / service mesh |
| Banco | RDS PostgreSQL Multi-AZ | **read replicas** + PgBouncer | particionamento/**sharding por tenant**, Aurora |
| Filas/eventos | Redis + BullMQ | tópicos dedicados | **Kafka/Kinesis** (event streaming) |
| Busca | Postgres Full-Text Search | índices dedicados | **OpenSearch/Elasticsearch** |
| Analytics | views SQL + Recharts | **ETL → data warehouse** (Redshift) | lakehouse + BI |
| Mídia/replays | S3 + MediaConvert + CloudFront | **IVS** (ao vivo) | pipeline de **IA: highlights automáticos** (visão computacional) |
| IA/ML | — | recomendação de horário, previsão de **no-show** | **preço dinâmico**, detecção de lances |
| Disponibilidade | Multi-AZ | **multi-região** + DR | ativo-ativo |
| Plataforma | API REST + webhooks | **API pública + SDK** | marketplace de integrações |
| Observabilidade | CloudWatch + Sentry + OTel | **Grafana/Prometheus** | tracing distribuído completo |

## 7. Projeção de produto (resumo)
Quadras de areia → **clubes esportivos** (jogadores, times, mensalidades, aulas) → **rede/marketplace** de quadras com descoberta e replays como diferencial. Detalhe e fases em Roadmap.

> Conexões: stack em [Arquitetura e Stack](arquitetura.md) · teoria em [Fundamentação Teórica e Padrões](fundamentacao.md) · segurança/LGPD em [Segurança, Privacidade e LGPD](seguranca-lgpd.md) · decisões em [Decisões de Arquitetura (ADRs)](adr/README.md).
