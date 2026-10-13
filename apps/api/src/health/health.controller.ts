import { Controller, Get } from "@nestjs/common";

import { Latencia } from "../common/latencia";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly latencia: Latencia,
  ) {}

  @Get()
  async check() {
    let db = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return { status: "ok", db, ts: new Date().toISOString() };
  }

  /**
   * Tempo de resposta por rota, para conferir o RNF-01.
   *
   * Fica sob `/health` porque e dado de operacao, nao de dominio. O que ele
   * expoe — nome de rota e tempo — ja e deduzivel por quem usa o aplicativo,
   * entao nao ha segredo a proteger aqui; o que existe e um alvo de
   * monitoramento, e o lugar dele e atras do proxy quando houver um.
   */
  @Get("latencia")
  latenciaPorRota() {
    const rotas = this.latencia.resumo();
    return {
      // Repetido aqui para o numero nao precisar de contexto externo: quem
      // abre esta rota ve a meta ao lado da medida.
      metaP95Ms: 300,
      rotas,
      // `null` e nao zero quando nao ha medida: zero diria "esta rapido".
      piorP95: rotas.length > 0 ? rotas[0].p95 : null,
    };
  }
}
