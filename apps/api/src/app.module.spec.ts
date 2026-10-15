// SPDX-License-Identifier: AGPL-3.0-or-later
import { INestApplication, RequestMethod } from "@nestjs/common";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";

import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";
import { AuthController } from "./modules/auth/auth.controller";
import { QuadrasController } from "./modules/quadras/quadras.controller";
import { PromocoesController } from "./modules/promocoes/promocoes.controller";
import { ReplaysController } from "./modules/replays/replays.controller";
import { ReservasController } from "./modules/reservas/reservas.controller";
import { GestaoController } from "./modules/gestao/gestao.controller";
import { QuadrasGestaoController } from "./modules/gestao/quadras-gestao.controller";

/** Lista "MÉTODO /caminho" de um controller a partir dos metadados do Nest. */
function rotasDe(controller: new (...args: never[]) => object): string[] {
  const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
  const prototipo = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(prototipo)
    .filter((nome) => nome !== "constructor")
    .flatMap((nome) => {
      const handler = prototipo[nome];
      const caminho = Reflect.getMetadata(PATH_METADATA, handler as object) as string | undefined;
      if (caminho === undefined) return [];
      const metodo = Reflect.getMetadata(METHOD_METADATA, handler as object) as RequestMethod;
      const sufixo = caminho === "/" ? "" : `/${caminho}`;
      return [`${RequestMethod[metodo]} /${base}${sufixo}`];
    });
}

describe("AppModule", () => {
  let app: INestApplication;

  /**
   * O grafo de injeção do Nest só falha em runtime — subir a aplicação inteira
   * (com o Prisma trocado por um dublê) pega módulo não importado ou provider
   * faltando antes do deploy.
   */
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    app = modulo.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("resolve todas as dependências dos módulos", () => {
    expect(app).toBeDefined();
  });

  it("expõe as rotas do fluxo do cliente", () => {
    const rotas = [
      ...rotasDe(AuthController),
      ...rotasDe(QuadrasController),
      ...rotasDe(PromocoesController),
      ...rotasDe(ReservasController),
      ...rotasDe(ReplaysController),
    ];

    expect(rotas).toEqual(
      expect.arrayContaining([
        "POST /auth/login",
        "GET /quadras",
        "GET /quadras/:id",
        "GET /quadras/:id/disponibilidade",
        "GET /promocoes/destaque",
        "GET /reservas/minhas",
        "GET /reservas/:id",
        "POST /reservas",
        "POST /reservas/:id/simular-pagamento",
        "GET /replays/meus",
      ]),
    );
  });

  it("expõe as rotas do painel de gestão", () => {
    const rotas = [
      ...rotasDe(GestaoController),
      ...rotasDe(QuadrasGestaoController),
    ];

    expect(rotas).toEqual(
      expect.arrayContaining([
        "GET /gestao/estabelecimentos",
        "GET /gestao/estabelecimentos/:estabelecimentoId/quadras",
        "GET /gestao/estabelecimentos/:estabelecimentoId/quadras/:quadraId",
        "POST /gestao/estabelecimentos/:estabelecimentoId/quadras",
        "PATCH /gestao/estabelecimentos/:estabelecimentoId/quadras/:quadraId",
      ]),
    );
  });
});
