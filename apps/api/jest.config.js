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
  coverageThreshold: {
    global: {
      statements: 75,
      lines: 73,
      branches: 45,
      functions: 48,
    },
  },
};
