// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.tsx"],
    include: ["src/**/*.spec.{ts,tsx}"],
    // A web rodava 153 testes sem nunca medir cobertura, enquanto a API mede
    // desde setembro. Era o mesmo tipo de lacuna que a varredura de 14/10
    // vinha fechando nos requisitos: ninguém sabia se os 153 cobriam 40% ou
    // 90% — e a resposta, medida, foi mais perto de 40.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Só código. Sem isto, o `README.md` dentro de `src/assets/fotos` é
      // lido como JavaScript e a geração do relatório quebra com
      // `PARSE_ERROR` — o relatório sai, mas incompleto e sem avisar.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // O próprio teste não é código medido.
        "src/**/*.spec.{ts,tsx}",
        "src/test/**",
        // O cenário dos portões de acessibilidade é fixture de teste.
        "src/acessibilidade/cenario.tsx",
        // **Pontos de entrada do App Router, que o jsdom não executa.** São
        // componentes de servidor `async` que o Next invoca com o contexto da
        // requisição; importá-los num teste de jsdom não roda a função, roda
        // o módulo. Medi-los conta como descoberto o que **nenhum** teste
        // unitário pode cobrir, e empurra o número para baixo por um motivo
        // que não é lacuna de verificação.
        //
        // A exclusão é de **entrada**, não de lógica: os `acoes.ts` (Server
        // Actions) **continuam medidos**, mesmo em 0%, porque ali há decisão
        // — a ordem entre apagar o cookie e confirmar a exclusão da conta,
        // por exemplo. Aquilo é lacuna de verificação de verdade, e esconder
        // seria maquiar a medida.
        //
        // O que cobre as páginas é o ensaio de usabilidade (novembro) e a
        // execução manual contra a API, não teste unitário.
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/route.ts",
        "src/app/robots.ts",
        "src/app/sitemap.ts",
        "src/middleware.ts",
      ],
      // **As quatro medidas passaram dos 70% que o RNF-13 exige.** O
      // caminho até aqui vale registrar: a primeira medição desta
      // configuração deu 47% de instruções, e o requisito estava marcado como
      // atendido medindo só a API. Depois de excluir os pontos de entrada que
      // o jsdom não executa e de cobrir o cliente autenticado e o botão de
      // ação compartilhado, foi a 61%. O que fechou a conta foram as **Server
      // Actions**, que eram a lacuna nomeada aqui e estavam entre 0% e 17% —
      // e que não são código de interface: são o que roda no servidor, onde
      // moram as decisões que a tela não pode desfazer.
      //
      // Medido: **79,05% de instruções, 72,93% de ramos, 75% de funções e
      // 80,57% de linhas**, com 247 testes.
      //
      // O piso continua **um ponto abaixo do medido**, e não no valor exigido:
      // piso colado na medida reprova na primeira linha nova que alguém não
      // cubra, o que é ruído, e ensina a baixar o piso em vez de escrever o
      // teste. A margem é a regra, não o número — foi a lição do piso colado
      // na medida, em 13/10, na API.
      //
      // O que resta descoberto são os três formulários de gestão, entre 37% e
      // 43%, e a grade de horários. São componentes de interface, e o que os
      // cobre de verdade é o ensaio de usabilidade de novembro.
      thresholds: {
        statements: 78,
        lines: 79,
        branches: 71,
        functions: 74,
      },
    },
  },
});
