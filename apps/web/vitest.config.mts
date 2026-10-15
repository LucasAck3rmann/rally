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
      // **Piso abaixo dos 70% do RNF-13, e isso é declaração e não
      // descuido.** A primeira medição desta configuração deu 47% de
      // instruções; com os pontos de entrada excluídos e duas suítes novas —
      // o cliente autenticado da API e o botão de ação compartilhado — está
      // em **61,1/65,05/66,2/62,18**. Continua abaixo dos 70.
      //
      // O piso entra um ponto abaixo do medido para **impedir piora**
      // enquanto a cobertura sobe. Fingir 70 aqui faria a CI reprovar hoje e
      // o piso ser removido amanhã, que é o oposto de uma trava — foi a
      // lição do piso colado na medida, em 13/10, na API.
      //
      // **O que falta para os 70 está identificado:** as Server Actions
      // (`acoes.ts`), em 0% a 17%, e os três formulários de gestão, entre 37%
      // e 43%. As ações são `"use server"` e exigem dublar `next/headers`
      // para serem importadas; é trabalho real e está na fila, não escondido.
      thresholds: {
        statements: 60,
        lines: 61,
        branches: 64,
        functions: 65,
      },
    },
  },
});
