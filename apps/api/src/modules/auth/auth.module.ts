import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { EmailModule } from "../email/email.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PapelGuard } from "./guards/papel.guard";
import { SenhaService } from "./senha.service";

@Module({
  imports: [
    // Pela porta de e-mail: a recuperacao de senha nao tem outro canal.
    // `EmailModule` e nao `NotificacoesModule` porque aquele importa este
    // para proteger suas rotas, e o ciclo seria recusado pelo NestJS.
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>("JWT_ACCESS_SECRET") ?? "dev-insecure-secret",
        signOptions: { expiresIn: "1d" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SenhaService, JwtAuthGuard, PapelGuard],
  // O guard protege rotas de outros módulos (reservas, replays).
  exports: [JwtAuthGuard, PapelGuard, JwtModule],
})
export class AuthModule {}
