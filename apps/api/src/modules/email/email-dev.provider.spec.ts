// SPDX-License-Identifier: AGPL-3.0-or-later
import { Logger } from "@nestjs/common";

import { EmailDevProvider } from "./email-dev.provider";

describe("EmailDevProvider", () => {
  it("registra destinatário, assunto e corpo, e não envia nada", async () => {
    // O corpo inteiro vai para o log de propósito: em desenvolvimento é o
    // único caminho até o que o cliente receberia — inclusive o link de
    // recuperação de senha, que não tem outra forma de chegar sem
    // mensageria.
    const aviso = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});

    await new EmailDevProvider().enviar({
      para: "lucas@exemplo.com",
      assunto: "Pagamento confirmado",
      texto: "Quadra 1 — 02/10, 08:00",
    });

    const escrito = aviso.mock.calls[0][0] as string;
    expect(escrito).toContain("lucas@exemplo.com");
    expect(escrito).toContain("Pagamento confirmado");
    expect(escrito).toContain("Quadra 1 — 02/10, 08:00");
    aviso.mockRestore();
  });

  it("avisa que é simulação, para o log não ser lido como entrega", async () => {
    // Em `warn` e com a palavra "simulado": um log de nível informativo
    // dizendo "e-mail enviado" faria alguém concluir que a mensageria está
    // de pé quando não está.
    const aviso = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});

    await new EmailDevProvider().enviar({
      para: "a@b.c",
      assunto: "x",
      texto: "y",
    });

    expect(aviso.mock.calls[0][0]).toMatch(/simulado/i);
    aviso.mockRestore();
  });
});
