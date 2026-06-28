import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Substitui a configuração depreciada `package.json#prisma` (Prisma 7).
// Com config file, o Prisma não carrega .env sozinho — carregamos o da raiz do monorepo.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "ts-node prisma/seed.ts",
  },
});
