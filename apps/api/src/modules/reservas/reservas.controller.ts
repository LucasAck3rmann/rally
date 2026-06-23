import { Body, Controller, Get, Post } from "@nestjs/common";
import { ReservasService } from "./reservas.service";
import { CreateReservaDto } from "./dto/create-reserva.dto";

@Controller("reservas")
export class ReservasController {
  constructor(private readonly reservas: ReservasService) {}

  @Get()
  listar() {
    return this.reservas.listar();
  }

  @Post()
  criar(@Body() dto: CreateReservaDto) {
    return this.reservas.criar(dto);
  }
}
