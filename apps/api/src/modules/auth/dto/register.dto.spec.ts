// SPDX-License-Identifier: AGPL-3.0-or-later
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { RegisterDto } from "./register.dto";

/** Erros de um corpo, por campo. */
async function erros(corpo: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(RegisterDto, corpo);
  const falhas = await validate(dto);
  return falhas.map((f) => f.property);
}

const VALIDO = {
  nome: "Lucas",
  email: "lucas@exemplo.com",
  senha: "senha123",
  aceitouTermos: true,
};

describe("RegisterDto — consentimento (RNF-07)", () => {
  it("aceita o cadastro com o consentimento dado", async () => {
    expect(await erros(VALIDO)).toEqual([]);
  });

  it("recusa quando o consentimento não vem", async () => {
    // Campo ausente não pode valer como aceite: a LGPD exige consentimento
    // inequívoco, e silêncio não é inequívoco.
    const { aceitouTermos: _, ...semAceite } = VALIDO;
    expect(await erros(semAceite)).toContain("aceitouTermos");
  });

  it("recusa quando a pessoa não aceitou", async () => {
    // `false` precisa ser recusado, e não gravado como "consentiu que não".
    expect(await erros({ ...VALIDO, aceitouTermos: false })).toContain("aceitouTermos");
  });

  it("a recusa diz o que fazer", async () => {
    const dto = plainToInstance(RegisterDto, { ...VALIDO, aceitouTermos: false });
    const [falha] = await validate(dto);

    expect(Object.values(falha.constraints ?? {}).join(" ")).toMatch(
      /aceitar a política de privacidade/i,
    );
  });

  it("não aceita texto no lugar do aceite", async () => {
    // `"true"` vindo de um formulário mal montado passaria por verdadeiro
    // num `if`, mas não é consentimento booleano registrado.
    expect(await erros({ ...VALIDO, aceitouTermos: "true" })).toContain("aceitouTermos");
  });

  it("continua exigindo nome, e-mail e senha", async () => {
    const vazios = await erros({
      nome: "L",
      email: "nao-e-email",
      senha: "123",
      aceitouTermos: true,
    });
    expect(vazios.sort()).toEqual(["email", "nome", "senha"]);
  });
});
