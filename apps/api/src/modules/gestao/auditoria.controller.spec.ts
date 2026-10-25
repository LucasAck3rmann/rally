// SPDX-License-Identifier: AGPL-3.0-or-later
import { AuditoriaService } from "../auditoria/auditoria.service";
import { AuditoriaController } from "./auditoria.controller";

/**
 * A rota de leitura da trilha (RN-05).
 *
 * O manipulador não era executado por teste nenhum, e o que ele faz é
 * pequeno e decisivo: traduzir um parâmetro de URL — que é texto, e pode não
 * vir — no número que o serviço espera.
 *
 * A restrição de papel não é verificada aqui: ela mora nos decoradores
 * `@UseGuards(PapelGuard)` e `@Papeis(ADMIN)`, e quem a prende é o
 * `papel.guard.spec.ts`. Chamar o método direto passa por cima dos guardas,
 * e um teste que fingisse verificá-los aqui diria o que não mediu.
 */
describe("AuditoriaController.listar", () => {
  const listar = jest.fn().mockResolvedValue([]);
  const controller = new AuditoriaController({
    listar,
  } as unknown as AuditoriaService);

  beforeEach(() => jest.clearAllMocks());

  it("sem `limite` na URL, pede cem", async () => {
    await controller.listar("e1");
    expect(listar).toHaveBeenCalledWith("e1", 100);
  });

  it("com `limite`, converte o texto da URL em número", async () => {
    // Parâmetro de consulta chega como texto; passar `"250"` adiante faria
    // o `take` do Prisma receber string.
    await controller.listar("e1", "250");
    expect(listar).toHaveBeenCalledWith("e1", 250);
  });

  it("repassa o estabelecimento da rota, e não um fixo", async () => {
    await controller.listar("outra-arena", "10");
    expect(listar.mock.calls[0][0]).toBe("outra-arena");
  });
});
