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
  // Medido em 08/10/2026, sem banco (integração pulada), logo um piso do
  // piso: 87,99% de instruções, 87,52% de linhas, 76,78% de ramos e 71,53%
  // de funções, com o bloco de gestão, a conciliação e a exportação em PDF
  // dentro. O piso sobe junto com a medida — piso muito abaixo do real para
  // de acusar regressão, que é o que ele faz.
  coverageThreshold: {
    global: {
      statements: 87,
      lines: 87,
      branches: 76,
      functions: 71,
    },
  },
};
