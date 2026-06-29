# Rally — App mobile (Flutter)

App cliente do Rally (Flutter + Riverpod + go_router), em **clean architecture**
(`data` / `domain` / `presentation`).

## Estrutura
```
lib/
├─ main.dart
├─ core/                 # tema (tokens Rally), router (guard de auth)
└─ features/
   ├─ splash/            # tela de abertura (decide login x home)
   ├─ auth/              # login + estado de autenticação + token seguro
   │  ├─ data/           # repositório (impl) + armazenamento seguro do token
   │  ├─ domain/         # contratos (interface) + modelos
   │  └─ presentation/   # providers, controller (Riverpod) e a tela de login
   └─ home/              # tela inicial autenticada
```

## Rodar
```bash
flutter pub get
flutter run
```
> Requer o **Flutter SDK** instalado. O login chama a **API real** (`POST /api/v1/auth/login`,
> JWT + argon2) via **Dio**; o token fica no `flutter_secure_storage` e é injetado
> automaticamente nas próximas requisições. Suba a API antes (`docker compose up` +
> `pnpm --filter @rally/api dev`) — no emulador Android a base é `http://10.0.2.2:3333/api/v1`.

## Segurança
- Token em **armazenamento seguro do dispositivo** (`flutter_secure_storage`), nunca em texto puro.
- **Guard de rota** (go_router `redirect`): sem sessão → `/login`; com sessão → `/home`.
- Validação de entrada nos formulários; contraste **WCAG AA** (texto grafite sobre coral).
