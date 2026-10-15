// SPDX-License-Identifier: AGPL-3.0-or-later
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ConciliacaoService } from "./conciliacao.service";

/**
 * Libera os horários cujo Pix expirou, de minuto a minuto (RN-13).
 *
 * **Substitui a expiração preguiçosa** que o PR #73 colocou no caminho de
 * leitura da grade. Aquela resolvia o defeito — checkout abandonado prendia
 * o horário para sempre — ao custo de escrever durante um GET, e eu a
 * declarei no PR como provisória. Esta é a versão que devia existir.
 *
 * A varredura da grade **fica**, como rede de segurança: se o processo
 * cair, o próximo cliente que abrir aquela quadra ainda vê o horário livre.
 * É barata — uma consulta que não acha nada no caso comum.
 */
@Injectable()
export class ExpiracaoDePendentesJob {
  private readonly logger = new Logger(ExpiracaoDePendentesJob.name);

  constructor(
    private readonly conciliacao: ConciliacaoService,
    private readonly config: ConfigService,
  ) {}

  /**
   * De minuto em minuto, e não de hora em hora: o `pixExpiraMinutos` padrão
   * é 30, e uma janela de uma hora deixaria o horário preso por até o dobro
   * do tempo que a cobrança durou.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: "expirar-pix-pendente" })
  async executar(): Promise<void> {
    // Em teste o agendador do Nest não roda, mas o guarda evita que uma
    // suíte que levante o módulo inteiro comece a escrever no banco.
    if (this.config.get("NODE_ENV") === "test") return;

    try {
      const liberadas = await this.conciliacao.expirarPendentes({});
      if (liberadas > 0) {
        this.logger.log(`${liberadas} horário(s) liberado(s) por Pix expirado.`);
      }
    } catch (erro) {
      // Um job que estoura derruba o processo em algumas configurações do
      // Node. Falha de banco aqui é temporária: registra e tenta no
      // próximo minuto, em vez de levar a API com ela.
      this.logger.error(`Falha ao expirar pendentes: ${erro}`);
    }
  }
}
