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
  // piso: 87,12% de instruções, 86,39% de linhas, 75,72% de ramos e 69,23%
  // de funções, com todo o bloco de gestão e a conciliação dentro. O piso sobe junto com a medida —
  // piso muito abaixo do real para de acusar regressão, que é o que ele faz.
  coverageThreshold: {
    global: {
      statements: 87,
      lines: 86,
      branches: 75,
      functions: 69,
    },
  },
};
