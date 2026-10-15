// SPDX-License-Identifier: AGPL-3.0-or-later
import { Body, Controller, Post, UseGuards } from "@nestjs/common";

import { IngestarReplayDto } from "./dto/ingestar-replay.dto";
import { SegredoDeIngestaoGuard } from "./guards/segredo-de-ingestao.guard";
import { IngestaoDeReplaysService } from "./ingestao.service";

/**
 * Entrada dos clipes do provedor de captação (RF-30, ADR-0012).
 *
 * Fora de `/replays` do cliente de propósito: aqui quem chama é máquina, a
 * autenticação é por segredo compartilhado, e a resposta é idempotente.
 */
@Controller("integracoes/replays")
@UseGuards(SegredoDeIngestaoGuard)
export class IngestaoDeReplaysController {
  constructor(private readonly ingestao: IngestaoDeReplaysService) {}

  @Post()
  ingestar(@Body() dto: IngestarReplayDto) {
    return this.ingestao.ingestar(dto);
  }
}
