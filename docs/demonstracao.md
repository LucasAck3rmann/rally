# Demonstração — como subir o Rally numa máquina e mostrar

Roteiro para apresentar o sistema: a web no computador e o aplicativo num
celular Android, falando com a mesma API.

> **O que foi verificado e onde.** Os comandos de `pnpm`, Prisma e seed foram
> executados numa máquina Windows com PostgreSQL local, em 19/10/2026, e as
> treze telas abriram. O caminho com Docker e os comandos específicos do macOS
> (`ipconfig getifaddr`, Docker Desktop) **não foram executados por aqui** —
> são os equivalentes diretos, e estão marcados onde valem.

## 1. O que precisa estar instalado

| | Versão | Por quê |
| --- | --- | --- |
| Node | 22 | é a do `setup-node` da CI |
| pnpm | o do `packageManager` no `package.json` | `corepack enable` já resolve |
| Docker Desktop | qualquer recente | só para o PostgreSQL |

O Flutter **não** é preciso para a demonstração: o aplicativo vai instalado
como APK (seção 5).

```bash
corepack enable
node -v   # deve dizer v22.x
```

## 2. Banco de dados

O `docker-compose.yml` já declara o PostgreSQL com as credenciais que o
`.env.example` documenta — por isso nada precisa ser digitado duas vezes.

```bash
docker compose up -d postgres
```

**Sem Docker**, com um PostgreSQL instalado na máquina, basta criar o papel e a
base uma vez:

```bash
psql -U postgres -c "CREATE ROLE rally WITH LOGIN PASSWORD 'rally'" -c "CREATE DATABASE rally OWNER rally"
```

## 3. Dependências, esquema e dados

```bash
cp .env.example .env
pnpm install
pnpm --filter @rally/api exec prisma migrate deploy
pnpm --filter @rally/api exec prisma db seed
```

O seed cria duas arenas, as quadras, **dez reservas na semana**, oito
pagamentos, uma série de mensalista com o horizonte materializado e cinco
linhas de trilha. Sem ele o painel abre dizendo "nenhum movimento no período",
que é uma tela ruim para mostrar.

As contas que ele cria:

| Conta | Senha | Serve para |
| --- | --- | --- |
| `dono@arena.com` | `rally123` | entrar no painel de gestão |
| `cliente@rally.com` | `rally123` | entrar no aplicativo como jogador |

> ⚠️ São credenciais de demonstração, declaradas no `prisma/seed.ts`. Não
> existem fora desta base local.

## 4. Subir a API e a web

Dois terminais:

```bash
pnpm --filter @rally/api dev
```

```bash
pnpm --filter @rally/web dev
```

- site e painel: <http://localhost:3000>
- API: <http://localhost:3333/api/v1/health> — deve responder `{"status":"ok","db":"up"}`

**Confira a API antes de abrir o painel.** Se o `db` não disser `up`, o painel
abre vazio e o problema é o banco, não a tela.

## 5. O aplicativo no celular

O APK sai da integração contínua, porque nem toda máquina de desenvolvimento
tem o SDK do Android:

1. abra a execução mais recente em **Actions** no GitHub;
2. baixe o artefato **`rally-android`**;
3. descompacte e transfira o `app-release.apk` para o aparelho;
4. instale — o Android vai pedir para permitir "fontes desconhecidas" para o
   aplicativo que está instalando.

> O APK é assinado com a **chave de depuração**, que é o que o
> `build.gradle.kts` declara. Instala em aparelho e **não serve para a Play
> Store**.

### Apontar o aplicativo para o computador

O padrão de compilação é `10.0.2.2`, que é o apelido do computador **dentro do
emulador** do Android. Num celular de verdade esse endereço não existe, então o
endereço é escolhido no próprio aparelho:

1. computador e celular **na mesma rede Wi-Fi**;
2. descubra o IP do computador:

   ```bash
   ipconfig getifaddr en0      # macOS, Wi-Fi
   ```

3. no aplicativo, na tela de entrada, toque em **Servidor** e digite o IP —
   por exemplo `192.168.0.14`. A porta e o caminho são completados;
4. entre com `cliente@rally.com` / `rally123`.

Se não conectar, a causa quase sempre é uma destas três: redes diferentes, a
API não está no ar, ou o firewall do sistema está bloqueando a porta 3333 — no
macOS, o aviso de "aceitar conexões de entrada" aparece na primeira vez e
precisa ser aceito.

## 6. O que mostrar

| Tela | Onde | O que ela prova |
| --- | --- | --- |
| Página inicial | `/` | identidade visual e proposta |
| Painel do dono | `/gestao` | receita, ocupação e próximos jogos |
| Agenda | `/gestao/:id/agenda` | grade quadra a quadra, reservar, mover e bloquear |
| Mensalistas | `/gestao/:id/mensalistas` | o recurso que cinco dos dez gestores pediram |
| Trilha de auditoria | `/gestao/:id/auditoria` | quem fez o quê, exigência da RN-05 |
| Aplicativo | celular | a mesma API, da perspectiva do jogador |

## 7. Conferir que está tudo de pé

```bash
node tools/capturas.mjs --sem-salvar
```

Abre as treze telas e cobra o título de cada uma. Se passar, a demonstração
está pronta; se falhar, ele diz **qual** rota e em que página a navegação
terminou.
