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
  coverageThreshold: {
    global: {
      statements: 89,
      lines: 89,
      branches: 80,
      functions: 72,
    },
  },
};
