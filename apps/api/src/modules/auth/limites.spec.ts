// SPDX-License-Identifier: AGPL-3.0-or-later
import "reflect-metadata";

import { AuthController } from "./auth.controller";
import { LIMITES } from "./limites";

/** As chaves de metadado que o `@nestjs/throttler` deixou numa rota. */
function chavesDe(rota: string): string[] {
  const metodo = (AuthController.prototype as unknown as Record<string, object>)[rota];
  return Reflect.getMetadataKeys(metodo).map(String);
}

/** Se a rota diz alguma coisa sobre limite — declarando balde ou isenção. */
function declaraAlgo(rota: string): boolean {
  return chavesDe(rota).some((c) => c.toUpperCase().includes("THROTTLER"));
}

/** Janela em minutos e teto de cada balde, por nome. */
function balde(nome: string) {
  const achado = LIMITES.throttlers.find((t) => t.name === nome);
  if (!achado) throw new Error(`balde "${nome}" não existe`);
  return {
    minutos: Number(achado.ttl) / 60_000,
    limite: Number(achado.limit),
  };
}

describe("limites de tentativa nas rotas de autenticação (RNF-06)", () => {
  it("existe um balde para cada risco, com nome próprio", () => {
    expect(LIMITES.throttlers.map((t) => t.name).sort()).toEqual([
      "cadastro",
      "login",
      "recuperacao",
      "token",
    ]);
  });

  it("a recuperação é o balde mais apertado por minuto", () => {
    // É o único que **manda e-mail para terceiro**: sem limite, a rota vira
    // amplificador e enche a caixa de entrada de qualquer pessoa com o Rally
    // como remetente. Afrouxar isto sem pensar é o erro que este teste pega.
    const porMinuto = (nome: string) => {
      const b = balde(nome);
      return b.limite / b.minutos;
    };

    expect(porMinuto("recuperacao")).toBeLessThan(porMinuto("login"));
    expect(porMinuto("recuperacao")).toBeLessThan(porMinuto("token"));
  });

  it("o login deixa o humano que errou tentar de novo", () => {
    // Apertado demais vira suporte: quem digitou a senha errada duas vezes
    // precisa conseguir a terceira.
    const { limite, minutos } = balde("login");
    expect(minutos).toBe(1);
    expect(limite).toBeGreaterThanOrEqual(5);
    expect(limite).toBeLessThanOrEqual(15);
  });

  it("o cadastro conta por hora, e não por minuto", () => {
    // Criar conta é raro por pessoa; a janela curta não distinguiria uso
    // normal de criação em massa.
    expect(balde("cadastro").minutos).toBe(60);
  });

  it("nenhum balde é frouxo a ponto de não existir", () => {
    for (const t of LIMITES.throttlers) {
      expect(Number(t.limit)).toBeGreaterThan(0);
      expect(Number(t.limit)).toBeLessThanOrEqual(100);
      expect(Number(t.ttl)).toBeGreaterThan(0);
    }
  });

  /**
   * **Rota sem declaração não fica sem limite: fica com todos.**
   *
   * O `ThrottlerGuard` vale para o controlador inteiro. Quando um método não
   * traz `@Throttle`, o guard aplica os baldes do módulo e o mais apertado
   * passa a valer — sem aviso, sem erro, sem nada no código que o diga.
   *
   * Foi o que aconteceu com o `GET /me`: uma leitura da própria conta, atrás
   * do `JwtAuthGuard`, presa ao balde de dez por minuto desenhado para senha
   * errada repetida. Medido nesta máquina: a décima primeira leitura
   * respondia 429 com `Retry-After-login`. A tela de privacidade da web chama
   * `/me` a cada carregamento, e as Server Actions saem todas do mesmo
   * endereço — de modo que dez carregamentos por minuto, somando todos os
   * usuários, derrubavam a tela com erro de servidor.
   *
   * Este portão não escolhe o limite de ninguém. Ele cobra que a escolha
   * **exista**, porque o silêncio é que era perigoso.
   */
  it("toda rota de autenticação declara um balde, ou declara que não tem", () => {
    const rotas = Object.getOwnPropertyNames(AuthController.prototype).filter(
      (nome) => nome !== "constructor",
    );
    // Âncora: controlador vazio faria este portão passar sem olhar nada.
    expect(rotas.length).toBeGreaterThan(4);

    const mudas = rotas.filter((nome) => !declaraAlgo(nome));

    expect(mudas).toEqual([]);
  });

  /**
   * **Isentar pela metade é pior que não isentar.**
   *
   * `@SkipThrottle()` sem argumento isenta apenas o balde chamado `default`,
   * e aqui não existe nenhum com esse nome. Escrito assim, o decorador
   * parecia remover o limite e não removia nada — medido: a décima primeira
   * leitura continuava respondendo 429, com o decorador no lugar.
   *
   * O portão acima aceitaria essa grafia, porque metadado existe. Este cobra
   * o que importa: quem isenta, isenta **todos** os baldes configurados.
   */
  it("rota isenta é isenta de todos os baldes, e não só de um nome que não existe", () => {
    const nomes = LIMITES.throttlers.map((t) => String(t.name));

    for (const rota of Object.getOwnPropertyNames(AuthController.prototype)) {
      if (rota === "constructor") continue;
      const chaves = chavesDe(rota);
      const isenta = chaves.some((c) => c.startsWith("THROTTLER:SKIP"));
      if (!isenta) continue;

      const faltando = nomes.filter((n) => !chaves.includes(`THROTTLER:SKIP${n}`));
      expect(faltando).toEqual([]);
    }
  });
});
