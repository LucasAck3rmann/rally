# base
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# dev
FROM base AS dev
COPY . .
CMD ["pnpm", "--filter", "@rally/api", "dev"]

# build → produção
FROM base AS build
COPY . .
RUN pnpm --filter @rally/api build && pnpm prisma generate

FROM node:22-alpine AS prod
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3333
CMD ["node", "dist/main.js"]
