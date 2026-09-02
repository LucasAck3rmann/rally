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
  app.useStaticAssets(join(__dirname, "..", "public"), { prefix: "/static/" });

  const port = process.env.API_PORT ?? 3333;
  await app.listen(port);
  console.log(`Rally API em http://localhost:${port}/api/v1`);
}
bootstrap();
