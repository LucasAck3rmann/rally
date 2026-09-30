import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { ReservasModule } from "./modules/reservas/reservas.module";
import { QuadrasModule } from "./modules/quadras/quadras.module";
import { GestaoModule } from "./modules/gestao/gestao.module";
import { ReplaysModule } from "./modules/replays/replays.module";
import { PagamentosModule } from "./modules/pagamentos/pagamentos.module";
import { PromocoesModule } from "./modules/promocoes/promocoes.module";
import { AuthModule } from "./modules/auth/auth.module";
import { NotificacoesModule } from "./modules/notificacoes/notificacoes.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    QuadrasModule,
    GestaoModule,
    PromocoesModule,
    PagamentosModule,
    ReservasModule,
    ReplaysModule,
    NotificacoesModule,
  ],
})
export class AppModule {}
