<p align="center"><b>Rally</b> — do agendamento ao replay nas quadras de areia.</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
  <img alt="status" src="https://img.shields.io/badge/status-em%20desenvolvimento-orange">
</p>

Plataforma **open source** de **agendamento, gestão e replays** para quadras de areia
(beach tennis, futevôlei, vôlei), evoluindo para **clubes esportivos**. Produto + TCC (IFSul).

> ⚠️ Este repositório está na fase de **fundação**: contém **documentação, configuração e o
> modelo de dados**. O código de aplicação entra a partir do marco M1 (ver `docs/cronograma.md`).

## ✨ Funcionalidades (visão)
- Busca e **reserva** com disponibilidade em tempo real
- **Pagamento Pix** (AbacatePay) com confirmação por webhook
- Painel de **gestão** (agenda, quadras, financeiro, relatórios)
- **Replays** dos jogos para assistir e compartilhar
- Notificações (WhatsApp, push, e-mail)

## 🧱 Stack
Next.js · Flutter · NestJS · PostgreSQL/Prisma · Redis/BullMQ · **AWS** · Docker · Cloudflare.
Monorepo **Turborepo + pnpm**. Detalhes em [`docs/`](docs/) e no design system ([`DESIGN.md`](DESIGN.md)).

## 🗂 Estrutura
```
apps/        web (Next.js) · api (NestJS) · mobile (Flutter)
packages/    shared · ui · tokens · config
docs/        arquitetura, requisitos, ADRs e mais
infra/       Terraform (AWS) + Docker
```

## 🚀 Começar (quando o código entrar)
```bash
pnpm install
cp .env.example .env
docker compose up                 # web :3000 · api :3333 · postgres · redis · localstack
pnpm prisma migrate dev
pnpm prisma db seed
```

## 🤝 Contribuindo
Veja [CONTRIBUTING.md](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md).
Decisões de arquitetura ficam em [`docs/adr/`](docs/adr/).

## 📄 Licença
Core sob **AGPL-3.0** (ver [LICENSE](LICENSE)). Pacotes/SDK em Apache-2.0.
Uma **edição comercial/hospedada** está disponível — contato: hello@rally.app.
"Rally" e a marca são reservados.
