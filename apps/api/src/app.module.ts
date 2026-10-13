import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";

import { LIMITES } from "./modules/auth/limites";
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
    // Sem isto o `@Cron` do job de expiração nunca dispara, e a RN-13
    // volta a depender só da varredura preguiçosa da grade.
    ScheduleModule.forRoot(),
    // Limite de tentativa nas rotas de autenticacao (RNF-06). Global para o
    // modulo existir, mas so as rotas decoradas com `@Throttle` contam — o
    // resto da API segue sem limite, que e o certo: a grade de
    // disponibilidade e consultada em rajada pela propria tela.
    ThrottlerModule.forRoot(LIMITES),
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
