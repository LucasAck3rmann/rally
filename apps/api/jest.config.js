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
  ],

  // Piso, não meta. Os valores ficam logo abaixo do medido para a CI acusar
  // regressão sem quebrar por arredondamento. Quando a cobertura subir, suba o
  // piso junto — é o que impede o número de escorrer para baixo sem ninguém ver.
  //
  // Medido em 30/09/2026, sem banco (integração pulada), logo um piso do
  // piso: 82,41% de instruções, 81,54% de linhas, 62,42% de ramos e 55,81%
  // de funções. Os testes do `pagamentos.service` subiram os ramos de 48,76%
  // para 62,42% — os pisos antigos, de 29/09, já não acusariam regressão.
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 79,
      branches: 58,
      functions: 52,
    },
  },
};
