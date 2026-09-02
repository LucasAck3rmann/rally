// SPDX-License-Identifier: AGPL-3.0-or-later
import { Controller, Get, Param, Query } from "@nestjs/common";

import { DisponibilidadeDto } from "./dto/disponibilidade.dto";
import { ListarQuadrasDto } from "./dto/listar-quadras.dto";
import { QuadrasService } from "./quadras.service";

/** Vitrine pública: buscar quadras e consultar a agenda antes de entrar. */
@Controller("quadras")
export class QuadrasController {
  constructor(private readonly quadras: QuadrasService) {}

  @Get()
  listar(@Query() filtros: ListarQuadrasDto) {
    return this.quadras.listar(filtros);
  }

  @Get(":id")
  detalhe(@Param("id") id: string) {
    return this.quadras.detalhe(id);
  }

  @Get(":id/disponibilidade")
  disponibilidade(@Param("id") id: string, @Query() query: DisponibilidadeDto) {
    return this.quadras.disponibilidade(id, query.data);
  }
}
