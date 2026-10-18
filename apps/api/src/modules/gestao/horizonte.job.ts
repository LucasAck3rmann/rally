// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { RecorrenciasService } from "./recorrencias.service";

/**
 * Estende o horizonte das séries de mensalista (RF-36, ADR-0014).
 *
 * **O ADR-0014 declarou este trabalho e o campo que o mede, e por um dia só o
 * campo existiu.** A série guarda `materializadaAte`, o painel mostra a folga
 * em vermelho abaixo de duas semanas, e nada avançava o horizonte a não ser o
 * clique em "Gerar semanas" — que existe para pressa, não para rotina. Medida
 * sem nada que a mantenha mede a queda em vez de evitá-la, e *furo declarado é
 * furo que continua furo*.
 *
 * **Uma vez por dia**, e a comparação com os outros dois jobs é a razão. O que
 * expira Pix roda de minuto a minuto porque cada minuto de atraso prende um
 * horário vendável. O lembrete de jogo roda de dez em dez minutos porque sai
 * três horas antes e dez minutos não mudam nada para quem recebe. Aqui a folga
 * é de oito semanas: um dia de atraso consome 1/56 dela, e o aviso do painel
 * dispara com duas semanas restantes — quatorze execuções diárias de margem
 * antes de alguém precisar olhar. Rodar de hora em hora varreria todas as
 * séries da plataforma 24 vezes por dia para criar, quase sempre, nada.
 *
 * Às quatro da manhã porque a varredura escreve reservas, e a hora de menos
 * movimento é a que menos disputa a trava de exclusão com cliente reservando.
 */
@Injectable()
export class HorizonteDeMensalistasJob {
  private readonly logger = new Logger(HorizonteDeMensalistasJob.name);

  constructor(
    private readonly recorrencias: RecorrenciasService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM, { name: "horizonte-de-mensalistas" })
  async executar(): Promise<void> {
    // Em teste o agendador do Nest não roda, mas o guarda evita que uma suíte
    // que levante o módulo inteiro comece a escrever no banco.
    if (this.config.get("NODE_ENV") === "test") return;

    try {
      const r = await this.recorrencias.estenderHorizonte();
      // Nada a fazer não vira linha: o log precisa ser legível no dia em que
      // algo der errado, e uma linha diária de "0 séries" o enterraria.
      if (r.criadas > 0 || r.puladas > 0 || r.falhas > 0) {
        this.logger.log(
          `Horizonte: ${r.criadas} ocorrência(s) criada(s) em ${r.series} série(s), ` +
            `${r.puladas} semana(s) pulada(s), ${r.falhas} série(s) com falha.`,
        );
      }
      // Falha de série é a que exige olho humano: a ocorrência não nasceu, e
      // o horário aparece livre na grade tendo dono.
      if (r.falhas > 0) {
        this.logger.warn(
          `${r.falhas} série(s) não materializaram. O horário delas aparece ` +
            `livre na grade: confira a trilha e o painel de mensalistas.`,
        );
      }
    } catch (erro) {
      // Um job que estoura derruba o processo em algumas configurações do
      // Node. Falha aqui é temporária: registra e tenta na próxima volta.
      this.logger.error(`Falha ao estender o horizonte: ${erro}`);
    }
  }
}
