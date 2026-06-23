# Fundamentação Teórica e Padrões

> O *porquê* das escolhas da [Arquitetura e Stack](arquitetura.md). Serve de **embasamento teórico** do TCC (capítulo de fundamentação) e de guia de padrões para o código. Cada decisão de stack se ancora em um princípio consolidado de engenharia de software, não em preferência pessoal.

## 1. Por que fundamentar
Um TCC de sistema não defende só "o que" foi usado, mas "por quê". Ancorar a stack em **princípios, padrões e padrões de mercado** consolidados dá rigor acadêmico e reduz dívida técnica. As fontes estão em [§9](#9-referências).

## 2. Estilo arquitetural
- **Cliente-servidor / API-first:** clientes (web, mobile) desacoplados de um back-end de API. Permite múltiplos front-ends sobre o mesmo contrato.
- **Arquitetura em camadas:** apresentação → aplicação (casos de uso) → domínio → infraestrutura. Cada camada só conhece a de baixo.
- **Clean Architecture (R. C. Martin):** regra de dependência apontando para **dentro** — o domínio (regras de negócio) não depende de framework, banco ou UI. Frameworks são detalhes plugáveis.
- **Hexagonal / Ports & Adapters (A. Cockburn):** o núcleo expõe **portas** (interfaces); banco, gateway de pagamento, WhatsApp e storage são **adaptadores** intercambiáveis. Troca de AbacatePay/Stripe ou S3/R2 sem tocar no domínio.
- **DDD — Domain-Driven Design (E. Evans):** *linguagem ubíqua* (Reserva, Quadra, Estabelecimento), *bounded contexts* (reservas, pagamentos, replays), *agregados* e *eventos de domínio*. Mantém o modelo alinhado ao negócio das quadras.
- **Monorepo:** web/API/pacotes no mesmo repositório (Turborepo) — código compartilhado e versionado junto, com fronteiras explícitas via pacotes.

## 3. Princípios de design
- **SOLID:** Single Responsibility · Open/Closed · Liskov · Interface Segregation · Dependency Inversion — base da modularidade do NestJS (DI + interfaces).
- **DRY** (don't repeat yourself) · **KISS** (simplicidade) · **YAGNI** (não construir o que não é necessário — equilibra o "overengineering" com pragmatismo).
- **Separation of Concerns** e **Lei de Demeter** (baixo acoplamento).
- **12-Factor App:** config por ambiente, dependências explícitas, processos *stateless*, build/release/run separados, paridade dev/prod, logs como stream. Guia a conteinerização e o deploy.
- **Composição sobre herança**; **fail-fast** com validação na borda.

## 4. Padrões de projeto (onde aparecem no Rally)
| Padrão | Uso no projeto |
|---|---|
| **Repository** | acesso a dados isolado do domínio (Prisma atrás de interface) |
| **DTO + Mapper** | contratos de entrada/saída da API, validados (class-validator/Zod) |
| **Dependency Injection** | núcleo do NestJS — serviços injetados, testáveis |
| **Service / Use Case** | regra de negócio por caso de uso (criar reserva, confirmar pagamento) |
| **Adapter** | gateways externos (AbacatePay, WhatsApp, S3) atrás de interface |
| **Strategy** | métodos de pagamento / canais de notificação intercambiáveis |
| **Observer / Domain Events** | "reserva confirmada" dispara notificação + agenda replay |
| **Factory** | criação de entidades complexas |
| **Unit of Work / Transação** | consistência ao reservar + pagar |
| **CQRS-lite** | leitura (relatórios) separada da escrita quando útil |
> Catálogo clássico: *Design Patterns* (GoF) e *Patterns of Enterprise Application Architecture* (Fowler).

## 5. Padrões de API
- **REST** sobre HTTP, recursos no plural (`/reservas`), verbos semânticos, **status codes** corretos.
- **Modelo de maturidade de Richardson** (recursos → verbos → hipermídia) como referência de qualidade.
- **Contract-first / OpenAPI (Swagger):** o contrato documenta e gera tipos do cliente.
- **Versionamento** (`/api/v1`), **paginação**, **filtros**, **idempotency-key** em pagamentos.
- **Webhooks** com verificação de assinatura (AbacatePay, WhatsApp).
- **Erros** padronizados (RFC 7807 *Problem Details*).

## 6. Design de código (clean code)
- **Nomes reveladores de intenção**; funções pequenas e com responsabilidade única.
- **Evitar *code smells*** (duplicação, funções longas, acoplamento); **refatoração contínua** (Fowler).
- **Type-safety ponta a ponta** (TypeScript estrito, Dart sound types, Zod).
- **Lint + format automáticos** (ESLint/Prettier, `dart analyze`) — estilo não é opinião, é CI.
- **Testes como design:** pirâmide de testes (muitos unitários, alguns de integração, poucos e2e).
- **Comentar o "porquê", não o "o quê"**; código autoexplicativo.

## 7. Acessibilidade (WCAG 2.2 — nível AA)
- **Princípios POUR:** **P**erceptível, **O**perável, **C**ompreensível (Understandable), **R**obusto.
- **Contraste** mínimo 4.5:1 (texto) / 3:1 (texto grande, ícones) — base da regra "nunca branco sobre coral" do design system.
- **Navegação por teclado**, foco visível, **alvos ≥ 44px**, semântica HTML + **WAI-ARIA** quando necessário.
- **Responsivo** e respeito a `prefers-reduced-motion`.
- Operacionalizado no [DESIGN.md (raiz do repo)](../DESIGN.md) e na skill `rally-design-system`. É também um **diferencial de mercado** e, no Brasil, conversa com a **LBI (Lei 13.146/2015)**.

## 8. Metodologia e padrões de mercado
- **Versionamento:** Git + **Conventional Commits** + **SemVer** (histórico legível, releases automatizáveis).
- **Fluxo:** *trunk-based*/GitHub Flow, PRs curtos, **code review** obrigatório, CODEOWNERS.
- **CI/CD** e **DevOps** (integração/entrega contínuas, *infrastructure as code*).
- **Gestão ágil:** Kanban/Scrum-lite (issues por fase do Roadmap); para o TCC, entregas incrementais.
- **Documentação como parte do produto:** ADRs, OpenAPI, este vault como fonte de contexto (inclusive para IA).

## 9. Referências
Bibliografia/specs de apoio (para citar no TCC):
- MARTIN, R. C. *Clean Architecture* (2017) e *Clean Code* (2008).
- EVANS, E. *Domain-Driven Design* (2003).
- FOWLER, M. *Refactoring* (2018) e *Patterns of Enterprise Application Architecture* (2002).
- GAMMA et al. *Design Patterns* — GoF (1994).
- COCKBURN, A. *Hexagonal Architecture* (Ports & Adapters).
- **The Twelve-Factor App** — 12factor.net.
- **W3C WCAG 2.2** e **WAI-ARIA** — w3.org/WAI.
- **OWASP** Top 10 / ASVS — ver [Segurança, Privacidade e LGPD](seguranca-lgpd.md).
- **LGPD** — Lei 13.709/2018; **LBI** — Lei 13.146/2015.
- Documentações oficiais: Next.js, NestJS, Flutter, Prisma, AWS Well-Architected Framework.

> Conexões: implementação em [Arquitetura e Stack](arquitetura.md) · segurança/leis em [Segurança, Privacidade e LGPD](seguranca-lgpd.md) · design em [DESIGN.md (raiz do repo)](../DESIGN.md).
