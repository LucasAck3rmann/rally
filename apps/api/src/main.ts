import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "node:path";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
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
