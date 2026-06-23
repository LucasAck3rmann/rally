# Requisitos

> Requisitos **funcionais (RF)** e **não-funcionais (RNF)** do Rally, com casos de uso e métricas mensuráveis — o terceiro pilar do tripé de engenharia ([Arquitetura e Stack](arquitetura.md) · [Fundamentação Teórica e Padrões](fundamentacao.md) · este). Prioridade em **MoSCoW**; o **MVP (TCC)** é o conjunto *Must*. Atende [Segurança, Privacidade e LGPD](seguranca-lgpd.md) nos RNF.

## 1. Atores
- **Cliente/Jogador** — busca, reserva, paga, assiste/baixa replay.
- **Atendente** — opera agenda e reservas no balcão.
- **Financeiro** — acompanha receita, conciliação, relatórios.
- **Admin/Dono** — configura quadras, preços, equipe, promoções.
- **Mantenedor (SaaS-admin)** — gerencia estabelecimentos e planos da plataforma.
- **Sistema** — jobs assíncronos (lembretes, processamento de replay, webhooks).

## 2. Requisitos Funcionais (RF)
Prioridade: **M** = Must (MVP) · **S** = Should · **C** = Could · **W** = Won't (agora).

### Conta e acesso
- **RF-01 (M):** Cadastro e login de cliente (e-mail/senha + OAuth Google/Instagram).
- **RF-02 (M):** Autenticação da equipe com **papéis** (atendente, financeiro, admin) — RBAC.
- **RF-03 (S):** Recuperação de senha e verificação de e-mail.
- **RF-04 (C):** MFA para contas de gestão.

### Descoberta e reserva
- **RF-05 (M):** Buscar quadras por modalidade, data, horário e localização.
- **RF-06 (M):** Ver detalhe da quadra (fotos, modalidades, comodidades, preço).
- **RF-07 (M):** Ver **disponibilidade em tempo real** e selecionar data/horário.
- **RF-08 (M):** Criar reserva **sem conflito** (controle de concorrência — ver [RN-01](#5-regras-de-negócio-rn)).
- **RF-09 (M):** Cancelar/remarcar reserva conforme política ([RN-02](#5-regras-de-negócio-rn)).
- **RF-10 (S):** Histórico "Minhas reservas".
- **RF-11 (C):** Lista de espera para horário lotado.

### Pagamento
- **RF-12 (M):** Pagar reserva via **Pix (AbacatePay)**; cartão como alternativa.
- **RF-13 (M):** Confirmar pagamento por **webhook assinado** e atualizar a reserva.
- **RF-14 (S):** Aplicar desconto no Pix ([RN-03](#5-regras-de-negócio-rn)) e cupons.
- **RF-15 (C):** Reembolso/estorno pelo painel.

### Notificações
- **RF-16 (M):** Confirmação de reserva (in-app + e-mail).
- **RF-17 (S):** Lembrete antes do jogo (WhatsApp/push).
- **RF-18 (S):** Aviso de "replay disponível".
- **RF-19 (C):** Campanhas de promoção (opt-in).

### Gestão (painel do dono)
- **RF-20 (M):** Cadastrar/editar quadras, modalidades e **preços** (inclui preço por faixa de horário).
- **RF-21 (M):** **Agenda** das quadras (dia/semana) com criar/mover/cancelar/**bloquear** horário.
- **RF-22 (M):** Painel com ocupação, receita e próximos jogos.
- **RF-23 (M):** Gerenciar **usuários e permissões** (equipe e clientes).
- **RF-24 (S):** Controle de **materiais/estoque**.
- **RF-25 (S):** **Promoções/cupons** (código, desconto, validade, usos).
- **RF-26 (C):** **Eventos/torneios** (inscrição, chaveamento básico).

### Financeiro e relatórios
- **RF-27 (M):** Relatórios de receita, ocupação, ticket médio e métodos de pagamento.
- **RF-28 (M):** **Exportar** relatórios em **CSV/XLSX** (e PDF).
- **RF-29 (S):** Conciliação de pagamentos (recebido vs. previsto).

### Replays (diferencial)
- **RF-30 (S):** Vincular **replay** do jogo à reserva/cliente.
- **RF-31 (S):** Assistir, baixar e **compartilhar** clipe.
- **RF-32 (W→futuro):** **Highlights automáticos** por IA.

### Mantenedor / SaaS
- **RF-33 (S):** Gerenciar estabelecimentos, planos (Free/Pro/Clube) e cobrança.
- **RF-34 (S):** Métricas da plataforma (MRR, churn, crescimento).
- **RF-35 (W→futuro):** **Multi-estabelecimento** e módulo de **clubes** (jogadores, times, mensalidades).

## 3. Casos de uso detalhados (críticos)

### CU-01 — Reservar e pagar uma quadra
**Ator:** Cliente · **Pré:** autenticado · **Pós:** reserva `confirmada` e horário bloqueado.
1. Cliente busca (RF-05) e abre a quadra (RF-06).
2. Sistema mostra disponibilidade em tempo real (RF-07).
3. Cliente escolhe horário e confirma.
4. Sistema **reserva o slot** com trava de concorrência (RN-01) → estado `pendente_pagamento`.
5. Cliente paga via Pix (RF-12); gateway gera QR.
6. **AbacatePay** envia **webhook** de pagamento (RF-13); sistema valida assinatura e idempotência → reserva `confirmada`.
7. Sistema notifica confirmação (RF-16) e agenda lembrete (RF-17).
- **Alt. 5a:** pagamento expira → slot é liberado, reserva `cancelada`.
- **Alt. 6a:** webhook não chega no prazo → job de reconciliação consulta o gateway.

### CU-02 — Bloquear horário (manutenção)
**Ator:** Admin/Atendente. Seleciona quadra+intervalo na agenda (RF-21) → cria bloqueio → slot fica indisponível para clientes (não gera cobrança).

### CU-03 — Disponibilizar replay
**Ator:** Sistema. Após o jogo, o vídeo vai pro **S3** → **MediaConvert** transcodifica → clipe vinculado à reserva (RF-30) → cliente é notificado (RF-18) e assiste via **CloudFront** (RF-31).

## 4. Requisitos Não-Funcionais (RNF) — mensuráveis
| ID | Categoria | Métrica-alvo |
|---|---|---|
| **RNF-01** | Performance (API) | p95 de resposta **< 300 ms**; busca de disponibilidade **< 500 ms** |
| **RNF-02** | Performance (web) | **LCP < 2,5 s**, INP < 200 ms (Core Web Vitals "bom") |
| **RNF-03** | Concorrência | **zero overbooking** sob reservas simultâneas (teste de carga concorrente) |
| **RNF-04** | Disponibilidade | **≥ 99,5%/mês** (Multi-AZ); health checks + failover |
| **RNF-05** | Escalabilidade | suportar **1.000 reservas/dia** e picos 10× sem degradar (autoscaling + filas) |
| **RNF-06** | Segurança | OWASP Top 10 mitigado; senhas argon2; TLS 1.2+; 0 segredo em código — ver [Segurança, Privacidade e LGPD](seguranca-lgpd.md) |
| **RNF-07** | Privacidade/LGPD | exportar e **excluir** dados do titular **≤ 15 dias**; consentimento registrado |
| **RNF-08** | Acessibilidade | **WCAG 2.2 AA** nas telas principais (contraste, teclado, alvos ≥ 44px) |
| **RNF-09** | Compatibilidade | web responsivo (mobile→desktop); app **iOS 14+/Android 8+** |
| **RNF-10** | Confiabilidade de pagamento | webhook **idempotente**; reconciliação garante consistência reserva↔pagamento |
| **RNF-11** | Observabilidade | erros no **Sentry**, logs/métricas no **CloudWatch**, tracing OTel; alertas |
| **RNF-12** | Backup/DR | backup diário + **PITR**; RPO ≤ 24h, RTO ≤ 4h; restauração testada |
| **RNF-13** | Manutenibilidade | cobertura de testes **≥ 70%** no core; CI verde obrigatório p/ merge |
| **RNF-14** | Internacionalização | pt-BR padrão, base preparada para i18n |

## 5. Regras de negócio (RN)
**Reserva & agenda**
- **RN-01:** um slot (quadra × horário) admite **uma** reserva ativa; concorrência resolvida por transação + **exclusion constraint** no banco (ver [Modelo de Dados (schema.prisma)](modelo-de-dados.md)).
- **RN-02:** cancelamento gratuito até **X horas** antes (configurável por estabelecimento); depois, política de cobrança/sem reembolso.
- **RN-06:** reserva só dentro do **horário de funcionamento** da quadra/estabelecimento (timezone do estabelecimento).
- **RN-07:** **antecedência mínima** (ex.: 1h) e **máxima** (ex.: 30 dias) para reservar — configurável.
- **RN-08:** duração da reserva em **múltiplos do slot** (ex.: 30/60 min); duração mínima configurável.
- **RN-09:** **bloqueio** (manutenção) ocupa o slot e **não gera cobrança** nem aparece como disponível.
- **RN-10:** limite de **reservas simultâneas ativas por cliente** (anti-abuso), configurável.
- **RN-11 (futuro):** quando há **lista de espera**, vaga liberada é oferecida por ordem e expira se não confirmada.

**Preço, pagamento & cupom**
- **RN-03:** pagamento via **Pix** pode ter desconto (ex.: −5%), configurável.
- **RN-04:** preço varia por **modalidade** e **faixa de horário** (pico/fora de pico).
- **RN-12:** o **preço é congelado** no momento da criação da reserva (mudança de tabela depois não afeta reserva existente).
- **RN-13:** **Pix expira** em N minutos; ao expirar, a reserva é cancelada e o slot **liberado** automaticamente.
- **RN-14:** cupom respeita **validade**, **limite de usos** e regras de elegibilidade; **não acumulável** com outro desconto, salvo configuração.
- **RN-15:** **reembolso/estorno** segue a política de cancelamento (RN-02) e é registrado para conciliação.

**Acesso, dados & replays**
- **RN-05:** papéis (RBAC) definem o que cada membro da equipe acessa; ações sensíveis são **auditadas**.
- **RN-16:** **isolamento multi-tenant** — um usuário/estabelecimento nunca enxerga dados de outro (filtro por `estabelecimentoId`).
- **RN-17:** **replay** fica disponível ao cliente por um período de **retenção** configurável; depois é arquivado/expirado (custo + LGPD).
- **RN-18:** exclusão de conta (LGPD) anonimiza dados pessoais mantendo registros financeiros exigidos por lei — ver [Segurança, Privacidade e LGPD](seguranca-lgpd.md).

## 6. Recorte do MVP (TCC)
**Must** = MVP: RF-01,02,05,06,07,08,09,12,13,16,20,21,22,23,27,28 + RNF-01,03,04,06,07,08,10,12,13.
*Should/Could* (replays em produção, WhatsApp, eventos, mantenedor completo, clubes) entram como **evolução** — ver [§14 de Arquitetura](Arquitetura%20e%20Stack.md) e Roadmap.

> Próximo refinamento: diagramas de caso de uso (UML) e de sequência para CU-01, se a banca pedir formalização.
