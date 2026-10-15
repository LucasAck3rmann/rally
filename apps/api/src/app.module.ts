// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";

import { LatenciaModule } from "./common/latencia.module";
import { TempoDeRespostaInterceptor } from "./common/tempo-de-resposta.interceptor";
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
import { PrivacidadeModule } from "./modules/privacidade/privacidade.module";

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
    // Mede o tempo de resposta de toda rota (RNF-01). Global para o
    // interceptor e a rota de saude lerem a mesma janela.
    LatenciaModule,
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
    PrivacidadeModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TempoDeRespostaInterceptor },
  ],
})
export class AppModule {}
