import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateReservaDto } from "./dto/create-reserva.dto";

@Injectable()
export class ReservasService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.reserva.findMany({
      take: 50,
      orderBy: { inicio: "desc" },
    });
  }

  // Esqueleto — a trava de concorrência (RN-01) e o fluxo de pagamento (RF-12/13)
  // entram no marco M3 do cronograma.
  async criar(_dto: CreateReservaDto) {
    return { todo: "implementar reserva com trava de concorrência (RN-01)" };
  }
}
