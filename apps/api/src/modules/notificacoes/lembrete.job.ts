// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { LembreteService } from "./lembrete.service";

/**
 * Dispara o lembrete de jogo (RF-17).
 *
 * **De dez em dez minutos**, e nao de minuto a minuto como o job que expira
 * Pix. A diferenca e de consequencia: la, cada minuto de atraso prende um
 * horario que poderia ser vendido; aqui, dez minutos de folga num aviso que
 * sai tres horas antes nao mudam nada para quem recebe — e a consulta custa
 * menos sendo feita seis vezes por hora.
 */
@Injectable()
export class LembreteDeJogoJob {
  private readonly logger = new Logger(LembreteDeJogoJob.name);

  constructor(
    private readonly lembretes: LembreteService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, { name: "lembrete-de-jogo" })
  async executar(): Promise<void> {
    // Em teste o agendador do Nest nao roda, mas o guarda evita que uma
    // suite que levante o modulo inteiro comece a escrever no banco.
    if (this.config.get("NODE_ENV") === "test") return;

    try {
      const enviados = await this.lembretes.enviarPendentes();
      // So registra quando houve o que registrar: uma linha a cada dez
      // minutos afogaria o log de qualquer coisa que importe.
      if (enviados > 0) {
        this.logger.log(`${enviados} lembrete(s) de jogo enviado(s).`);
      }
    } catch (erro) {
      // Um job que estoura derruba o processo em algumas configuracoes do
      // Node. Falha aqui e temporaria: registra e tenta na proxima volta.
      this.logger.error(`Falha ao enviar lembretes: ${erro}`);
    }
  }
}
