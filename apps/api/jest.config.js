// SPDX-License-Identifier: AGPL-3.0-or-later
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],

  // RNF-13 pede "cobertura >= 70% no núcleo". Sem medição o requisito era uma
  // afirmação — "temos N testes" não é cobertura. Aqui ele vira número.
  collectCoverageFrom: [
    "**/*.ts",
    // `main.ts` só levanta o processo: cobri-lo exigiria subir a aplicação
    // inteira para provar duas linhas de bootstrap.
    "!main.ts",
    "!**/*.spec.ts",
    // Auxiliar de teste (leitor de PDF): e teste, nao nucleo medido.
    "!**/*.spec-helper.ts",
  ],

  // Piso, não meta. Os valores ficam logo abaixo do medido para a CI acusar
  // regressão sem quebrar por arredondamento. Quando a cobertura subir, suba o
  // piso junto — é o que impede o número de escorrer para baixo sem ninguém ver.
  //
  // Medido em 13/10/2026: 90,09% de instruções, 89,84% de linhas, 81,16% de
  // ramos e 72,86% de funções. O salto em relação a 08/10 não veio de código
  // novo, veio de `criar()` passar a ter teste — ele é onde a reserva nasce e
  // não era exercitado por nada.
  //
  // **O número é o mesmo com e sem banco.** A suposição anterior, de que a
  // CI mediria mais por rodar a integração junto, não se sustentou: a
  // execução com Postgres roda 10 testes a mais e devolve exatamente
  // 90,09/81,16/72,86/89,84. É porque os testes de integração escrevem
  // direto no Prisma para provar restrição do banco — eles não passam por
  // código de aplicação que já não estivesse coberto.
  //
  // Por isso o piso fica um ponto abaixo do medido, e não colado nele. Piso
  // a 0,09 ponto da medida não acusa regressão: ele quebra na primeira linha
  // nova que alguém não cobrir, que é ruído, e ensina a baixar o piso em vez
  // de escrever o teste.
  //
  // **Medido em 14/10, depois das suítes dos dois guardas e do controlador de
  // relatórios: 93,63/83,72/78,01/93,56.** O salto veio de onde a assimetria
  // apontava: o `JwtAuthGuard` tinha 0% de ramos e o controlador de
  // exportação tinha os três manipuladores sem nenhuma execução.
  //
  // **Medido de novo no fim do dia: 94,41/84,56/82,66/94,44.** O segundo salto
  // é quase todo de funções, e veio da suíte `identidade-do-token.spec.ts`,
  // que exercita os manipuladores dos cinco controladores do cliente de uma
  // vez — ela existe por uma propriedade de segurança, e a cobertura foi
  // consequência e não objetivo.
  //
  // Os pisos sobem mantendo a mesma margem de um ponto. **A margem é a regra,
  // não o número:** piso colado na medida quebra na primeira linha nova que
  // alguém não cobrir e ensina a baixar o piso em vez de escrever o teste.
  //
  // **Medido em 23/10: 95,21/86,09/84,08/95,13.** Desta vez a margem foi o que
  // apontou o caminho, e não a medida: o piso de ramos estava a **0,62 ponto**
  // da medição, abaixo do ponto de folga que esta decisão exige. Ou seja, a
  // cobertura de ramos havia **caído** desde 14/10, e o aperto da margem foi
  // quem contou.
  //
  // O que estava descoberto não era difuso: `promocoes.service.ts` e
  // `replays.service.ts` tinham **0% de ramos**, sete decisões cada, serviço
  // inteiro sem nenhum caminho percorrido. Os dois decidem o que o cliente vê
  // — qual cupom entra na Home e quais clipes aparecem no filtro —, e nenhuma
  // dessas decisões era exercitada. Cobri-los devolveu os 14 ramos e levou a
  // medida de 83,62 para 86,09.
  //
  // A lição a guardar é sobre o instrumento: **a margem avisou antes de o piso
  // quebrar.** Piso colado teria passado a regressão em silêncio até alguém
  // reprovar por uma linha nova qualquer.
  coverageThreshold: {
    global: {
      statements: 94,
      lines: 94,
      branches: 85,
      functions: 83,
    },
  },
};
