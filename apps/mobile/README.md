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
> Requer o **Flutter SDK** instalado. Login está **stubado** (simula a rede e guarda
> um token de exemplo no `flutter_secure_storage`); a integração real com a API
> (`POST /api/v1/auth/login` via Dio) entra no Marco **M3**.

## Segurança
- Token em **armazenamento seguro do dispositivo** (`flutter_secure_storage`), nunca em texto puro.
- **Guard de rota** (go_router `redirect`): sem sessão → `/login`; com sessão → `/home`.
- Validação de entrada nos formulários; contraste **WCAG AA** (texto grafite sobre coral).
