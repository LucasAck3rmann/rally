// SPDX-License-Identifier: AGPL-3.0-or-later
import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";
import { Latencia } from "../common/latencia";

describe("HealthController", () => {
  let controller: HealthController;
  const prismaMock = { $queryRaw: jest.fn() };
  let latencia: Latencia;

  beforeEach(async () => {
    latencia = new Latencia();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: Latencia, useValue: latencia },
      ],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it("retorna status 'ok' e db 'up' quando o banco responde", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const res = await controller.check();
    expect(res.status).toBe("ok");
    expect(res.db).toBe("up");
  });

  it("retorna db 'down' quando o banco falha", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("sem conexão"));
    const res = await controller.check();
    expect(res.db).toBe("down");
  });

  describe("latência por rota (RNF-01)", () => {
    it("traz a meta ao lado da medida", () => {
      // Quem abre a rota vê 300 ms sem precisar procurar o requisito.
      latencia.registrar("GET /quadras", 120);
      expect(controller.latenciaPorRota().metaP95Ms).toBe(300);
    });

    it("destaca o pior p95, que é o que decide se o RNF-01 passa", () => {
      latencia.registrar("GET /rapida", 10);
      latencia.registrar("POST /lenta", 420);

      const saida = controller.latenciaPorRota();
      expect(saida.piorP95).toBe(420);
      expect(saida.rotas[0].rota).toBe("POST /lenta");
    });

    it("sem medida nenhuma, o pior p95 é nulo e não zero", () => {
      // Zero diria "está rápido"; nulo diz "não há o que medir", que é a
      // mesma distinção já feita na ocupação do painel.
      const saida = controller.latenciaPorRota();
      expect(saida.piorP95).toBeNull();
      expect(saida.rotas).toEqual([]);
    });
  });
});
