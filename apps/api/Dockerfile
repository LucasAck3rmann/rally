# base
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
# O schema entra antes do install porque o `postinstall` gera o Prisma Client.
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile

# dev
FROM base AS dev
COPY . .
CMD ["pnpm", "--filter", "@rally/api", "dev"]

# build → produção
FROM base AS build
COPY . .
RUN pnpm --filter @rally/api build

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
# As fotos do seed são servidas em /static; sem elas a imagem sobe com as
# imagens quebradas.
COPY --from=build /app/apps/api/public ./public
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3333
CMD ["node", "dist/main.js"]
