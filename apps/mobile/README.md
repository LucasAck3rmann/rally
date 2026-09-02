# Rally — App mobile (Flutter)

App do cliente (Flutter + Riverpod + go_router), em **clean architecture**
(`data` / `domain` / `presentation`), seguindo as telas do
[arquivo de design no Figma](https://www.figma.com/design/M6neeXlII8VbrxV5GOpo5Z)
e os tokens do [`DESIGN.md`](../../DESIGN.md) da raiz.

## Telas implementadas
Fluxo completo do cliente, do descobrir ao comprovante:

| Tela | Frame no Figma |
|---|---|
| Home (busca, chips, vitrine, promoção) | `Rally — Home (Cliente)` |
| Detalhe da quadra (comodidades + grade de horários) | `Rally — Detalhe da Quadra` |
| Checkout (resumo, Pix/cartão, valores) | `Rally — Checkout` |
| Pagamento Pix (QR, copia e cola, expiração) | `Rally — Pagamento Pix` |
| Confirmação (comprovante, agenda, compartilhar) | `Rally — Confirmação` |
| Replays (destaque + lista) | `Rally — Replays` |
| Perfil (números + menu da conta) | `Rally — Perfil` |
| Minhas reservas | *(sem frame; monta com os componentes do sistema)* |
| Splash e Login | `Rally — Login` |

## Estrutura
```
lib/
├─ main.dart
├─ core/
│  ├─ config/            # base URL da API
│  ├─ formato.dart       # moeda e datas em pt-BR
│  ├─ network/           # Dio + token seguro + tradução de erros da API
│  ├─ router/            # rotas + guard de autenticação
│  ├─ theme/             # tokens de cor e tipografia (Sora/Inter/Space Mono)
│  └─ widgets/           # design system: chip, botões, cabeçalhos, marquee...
└─ features/
   ├─ auth/ splash/      # sessão, token seguro e abertura
   ├─ home/              # Home do cliente
   ├─ quadras/           # vitrine, detalhe e disponibilidade
   ├─ reservas/          # checkout, Pix, confirmação e histórico
   ├─ replays/ perfil/ promocoes/
   └─ shell/             # casca com a navegação inferior
```

Os ícones de linha e o emblema em `assets/` são **exportados do Figma** e
tingidos por token em tempo de execução (`RallyIcon`).

## Rodar
```bash
flutter pub get
flutter run
```
> Requer o **Flutter SDK**. Suba a API antes (`docker compose up` +
> `pnpm --filter @rally/api dev` + `pnpm --filter @rally/api db:seed`).
> No emulador Android a base é `http://10.0.2.2:3333/api/v1`; no simulador iOS,
> use `--dart-define=API_BASE_URL=http://localhost:3333/api/v1`.
>
> Login do seed: `cliente@rally.com` / `rally123`.

Em modo debug a tela do Pix mostra um atalho **"simular pagamento"**, que chama
o endpoint de desenvolvimento no lugar do webhook do gateway.

## Segurança e acessibilidade
- Token em **armazenamento seguro do dispositivo** (`flutter_secure_storage`).
- **Guard de rota** (go_router `redirect`): sem sessão → `/login`.
- Preço e disponibilidade são **revalidados no servidor** na hora de reservar —
  o app nunca decide o valor cobrado.
- Contraste **WCAG AA** (texto grafite sobre coral, nunca branco), alvos de
  toque ≥ 44px e `prefers-reduced-motion` respeitado no marquee.
