// SPDX-License-Identifier: AGPL-3.0-or-later
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { join } from "node:path";

import { AppModule } from "./app.module";
import { opcoesDeCors, opcoesDeHelmet } from "./common/seguranca";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // O `x-powered-by` sai: anunciar "Express" entrega ao atacante qual lista
  // de falhas conhecidas consultar, e não serve a mais ninguém. A política
  // dos outros cabeçalhos está em `common/seguranca.ts`, onde é testada.
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.use(helmet(opcoesDeHelmet()));
  app.enableCors(opcoesDeCors());
  app.setGlobalPrefix("api/v1");

  // Fotos do seed de desenvolvimento (ver public/fotos/README.md).
  //
  // Resolvido a partir do diretório de trabalho, não do `__dirname`: o
  // layout do `dist` muda conforme o `include` do tsconfig, e amarrar o
  // caminho a ele já quebrou as fotos em silêncio uma vez.
  app.useStaticAssets(join(process.cwd(), "public"), { prefix: "/static/" });

  const port = process.env.API_PORT ?? 3333;
  await app.listen(port);
  console.log(`Rally API em http://localhost:${port}/api/v1`);
}
bootstrap();
