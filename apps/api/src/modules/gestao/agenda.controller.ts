// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { Auditar } from "../auditoria/auditar.decorator";
import { AuditoriaInterceptor } from "../auditoria/auditoria.interceptor";
import { AgendaService } from "./agenda.service";
import { CriarBloqueioDto } from "./dto/criar-bloqueio.dto";
import { MoverReservaDto } from "./dto/mover-reserva.dto";

/**
 * Agenda do dia e bloqueios de horário (RF-21).
 *
 * **Ler a agenda é de toda a equipe** — o atendente precisa saber quem joga
 * às 19h. **Bloquear é do admin**: tirar horário da venda é decisão de
 * operação, e um bloqueio errado custa faturamento.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId")
@UseGuards(JwtAuthGuard, PapelGuard)
@UseInterceptors(AuditoriaInterceptor)
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get("agenda")
  doDia(@Param("estabelecimentoId") estabelecimentoId: string, @Query("data") data: string) {
    return this.agenda.doDia(estabelecimentoId, data);
  }

  @Post("bloqueios")
  @Auditar({ acao: "bloquear horário", entidade: "Reserva" })
  @Papeis(Role.ADMIN)
  criarBloqueio(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Body() dto: CriarBloqueioDto,
  ) {
    return this.agenda.criarBloqueio(estabelecimentoId, dto);
  }

  /**
   * Mover é do admin, como bloquear: muda o horário combinado com um
   * cliente, e um arrasto errado na grade desmarca alguém que já pagou.
   */
  @Patch("reservas/:reservaId/mover")
  @Auditar({ acao: "mover reserva", entidade: "Reserva", parametro: "reservaId" })
  @Papeis(Role.ADMIN)
  moverReserva(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("reservaId") reservaId: string,
    @Body() dto: MoverReservaDto,
  ) {
    return this.agenda.moverReserva(estabelecimentoId, reservaId, dto);
  }

  @Delete("bloqueios/:bloqueioId")
  @Auditar({ acao: "liberar horário", entidade: "Reserva", parametro: "bloqueioId" })
  @Papeis(Role.ADMIN)
  removerBloqueio(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("bloqueioId") bloqueioId: string,
  ) {
    return this.agenda.removerBloqueio(estabelecimentoId, bloqueioId);
  }
}
