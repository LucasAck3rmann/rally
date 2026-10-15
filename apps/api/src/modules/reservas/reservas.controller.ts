// SPDX-License-Identifier: AGPL-3.0-or-later
import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JwtPayload } from "../auth/types/jwt-payload";
import { PagamentosService } from "../pagamentos/pagamentos.service";
import { CancelarReservaDto } from "./dto/cancelar-reserva.dto";
import { CreateReservaDto } from "./dto/create-reserva.dto";
import { RemarcarReservaDto } from "./dto/remarcar-reserva.dto";
import { ReservasService } from "./reservas.service";

/** Reservas do cliente autenticado — checkout, comprovante e histórico. */
@Controller("reservas")
@UseGuards(JwtAuthGuard)
export class ReservasController {
  constructor(
    private readonly reservas: ReservasService,
    private readonly pagamentos: PagamentosService,
  ) {}

  @Get("minhas")
  minhas(@CurrentUser() user: JwtPayload) {
    return this.reservas.minhas(user.sub);
  }

  @Get(":id")
  detalhe(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.reservas.detalhe(id, user.sub);
  }

  @Post()
  criar(@Body() dto: CreateReservaDto, @CurrentUser() user: JwtPayload) {
    return this.reservas.criar(dto, user.sub);
  }

  @Post(":id/remarcar")
  remarcar(
    @Param("id") id: string,
    @Body() dto: RemarcarReservaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reservas.remarcar(id, user.sub, dto);
  }

  @Post(":id/cancelar")
  cancelar(
    @Param("id") id: string,
    @Body() dto: CancelarReservaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reservas.cancelar(id, user.sub, dto.motivo);
  }

  /** Só em desenvolvimento: faz o papel do webhook do gateway. */
  @Post(":id/simular-pagamento")
  simularPagamento(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.pagamentos.simularPagamento(id, user.sub);
  }
}
