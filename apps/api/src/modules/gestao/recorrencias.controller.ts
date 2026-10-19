// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Role } from "@prisma/client";

import { Auditar } from "../auditoria/auditar.decorator";
import { AuditoriaInterceptor } from "../auditoria/auditoria.interceptor";
import { Papeis } from "../auth/decorators/papeis.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PapelGuard } from "../auth/guards/papel.guard";
import { CriarRecorrenciaDto, EditarRecorrenciaDto } from "./dto/recorrencia.dto";
import { RecorrenciasService } from "./recorrencias.service";

/**
 * Mensalistas da arena (RF-36, ADR-0014).
 *
 * Ler é de toda a equipe com vínculo — o atendente precisa saber de quem é o
 * horário de terça às 19h. **Escrever é do admin**, como toda escrita de
 * agenda: criar um mensalista ocupa horários futuros, e encerrá-lo os
 * devolve para a venda.
 */
@Controller("gestao/estabelecimentos/:estabelecimentoId/mensalistas")
@UseGuards(JwtAuthGuard, PapelGuard)
@UseInterceptors(AuditoriaInterceptor)
export class RecorrenciasController {
  constructor(private readonly recorrencias: RecorrenciasService) {}

  @Get()
  listar(@Param("estabelecimentoId") estabelecimentoId: string) {
    return this.recorrencias.listar(estabelecimentoId);
  }

  @Post()
  @Auditar({ acao: "criar mensalista", entidade: "Recorrencia" })
  @Papeis(Role.ADMIN)
  criar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Body() dto: CriarRecorrenciaDto,
  ) {
    return this.recorrencias.criar(estabelecimentoId, dto);
  }

  @Patch(":id")
  @Auditar({ acao: "editar mensalista", entidade: "Recorrencia", parametro: "id" })
  @Papeis(Role.ADMIN)
  editar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("id") id: string,
    @Body() dto: EditarRecorrenciaDto,
  ) {
    return this.recorrencias.editar(estabelecimentoId, id, dto);
  }

  /**
   * Materializa as ocorrências que faltam até o horizonte.
   *
   * Existe como rota porque o gestor precisa de um jeito de **recuperar** uma
   * série cujo horizonte parou de avançar — o `materializadaAte` da listagem
   * mostra que parou, e este botão resolve sem esperar o próximo ciclo do
   * trabalho agendado.
   */
  @Post(":id/materializar")
  @Auditar({
    acao: "materializar mensalista",
    entidade: "Recorrencia",
    parametro: "id",
  })
  @Papeis(Role.ADMIN)
  materializar(@Param("id") id: string) {
    return this.recorrencias.materializar(id);
  }

  @Delete(":id")
  @Auditar({ acao: "encerrar mensalista", entidade: "Recorrencia", parametro: "id" })
  @Papeis(Role.ADMIN)
  encerrar(
    @Param("estabelecimentoId") estabelecimentoId: string,
    @Param("id") id: string,
  ) {
    return this.recorrencias.encerrar(estabelecimentoId, id);
  }
}
