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
  //
  // **Medido em 25/10: 96,14/88,20/86,20/96,07.** Seguindo a mesma lista de
  // ramos descobertos, de onde saíram os dois serviços acima: a vitrine da
  // Home (`quadras.service.listar`) não tinha teste nenhum — sete funções sem
  // execução, numa tela que é a primeira que o jogador vê —, e o `login` só
  // exercitava a recusa por e-mail inexistente, deixando sem percorrer os
  // outros dois caminhos da mesma condição: conta sem senha e senha errada.
  // Ambos os arquivos ficaram em **zero ramos descobertos**.
  //
  // **Medido ainda em 25/10, depois do maior da lista: 96,80/90,31/87,00/96,77.**
  // O `reservas.service.ts` tinha doze ramos descobertos — as quatro portas
  // que o pedido atravessa antes de virar reserva, as duas leituras do
  // cliente (`minhas` e `detalhe`, nenhuma chamada por teste algum) e os
  // ramos de impasse do `remarcar`. Ficou em zero.
  //
  // Instruções e linhas **não sobem desta vez**: a margem delas já é de mais
  // de um ponto e meio, e apertar sem necessidade é o que a nota acima
  // adverte. Sobem ramos e funções, que foi onde o trabalho entrou.
  //
  // **Medido ao fim da lista, em 25/10: 97,29/93,33/88,32/97,22.** Entraram o
  // `recorrencias.service.ts` — `listar` e `editar` sem teste, mais os
  // argumentos padrão que só a produção usa — e três arquivos pequenos que
  // estavam em 0%: o controlador da trilha, o provedor Pix de
  // desenvolvimento e o serviço de auditoria.
  //
  // **O serviço de auditoria rendeu um defeito**, e não só cobertura: o teto
  // `Math.min(Math.max(limite, 1), 500)` deixava `NaN` passar inteiro, de
  // modo que `?limite=abc` mandava `take: NaN` ao Prisma. Teto protege
  // contra número grande, não contra não-número.
  //
  // **Medido em 26/10: 98,27/93,34/93,91/98,31.** O salto é todo de funções,
  // de 88,42% — e desta vez a cobertura foi consequência de uma pergunta de
  // segurança, e não o objetivo.
  //
  // A pergunta era por que as **funções** eram a medida mais fraca, e a
  // resposta foi que 33 das 44 descobertas eram **manipuladores de
  // controlador**: nenhum teste os chamava, porque as suítes de serviço
  // chamam o serviço direto. O manipulador é onde rota, guarda, DTO e serviço
  // se encontram, e a varredura de metadado escrita para cobri-los achou o
  // `RecorrenciasController.materializar` **sem o `estabelecimentoId`** — a
  // única rota da gestão que endereçava recurso por id sem dizer de qual
  // arena, de modo que a escrita caía na agenda de outra.
  //
  // Ramos **não sobem**: 93,34 contra piso 92 é 1,34 ponto, que é a margem
  // mínima. Instruções, linhas e funções sobem.
  //
  // **Medido em 26/10, depois dos ramos de agenda e cupons: 98,49/95,11/94,22/98,56.**
  // Os dois arquivos eram os maiores da lista de descobertos — 5 ramos cada —,
  // e os de `agenda` eram os mesmos três caminhos repetidos em dois métodos:
  // data que não é data, o recuo para `UTC` sem fuso no estabelecimento, e o
  // **impasse do banco**, que já havia sido tratado nas reservas e nunca
  // exercitado aqui.
  //
  // **E os cupons renderam um defeito.** O `atualizar` convertia as pontas da
  // validade para `Date` e as passava de volta como texto, com
  // `toISOString()` — que **estoura `RangeError: Invalid time value`** em data
  // inválida, antes de o guarda de `Number.isNaN` poder recusar. Era 500 onde
  // a resposta é 400, e explica por que aquele ramo estava descoberto: ele era
  // **inalcançável** por aquele caminho. O `criar` nunca teve o problema
  // porque passava o texto do DTO direto.
  //
  // Sobem ramos e funções, que foi onde a folga apareceu. Instruções e linhas
  // ficam: a margem delas é de um ponto e meio, e apertar sem necessidade é o
  // que a nota acima adverte.
  //
  // **Medido em 26/10, depois de `privacidade` e `quadras-gestao`:
  // 98,85/96,50/95,53/98,85.** No `privacidade` os quatro ramos eram recuos
  // `?? null` da **exportação de dados do titular** — exportar quem não
  // verificou o e-mail, não tem consentimento registrado e deixou um Pix
  // pendente, que é a conta comum de quem experimentou o aplicativo uma vez.
  // A exportação é obrigação legal e tem de funcionar em qualquer estado da
  // conta, não no estado bonito.
  //
  // No `quadras-gestao` o `detalhe` **não tinha teste nenhum**, e é a leitura
  // que alimenta o formulário de edição; e o `map` das faixas de preço nunca
  // rodava, porque toda fixture do arquivo trazia `faixasPreco: []`.
  //
  // **A regra da margem impediu subir dois dos quatro pisos, e vale
  // registrar.** Instruções e linhas medem 98,85: piso 98 deixaria **0,85
  // ponto**, abaixo do ponto que esta nota exige. Ficam em 97. É a primeira
  // vez que a regra age como freio em vez de como alarme — e é o mesmo
  // raciocínio, porque piso colado quebra na primeira linha nova.
  coverageThreshold: {
    global: {
      statements: 97,
      lines: 97,
      branches: 95,
      functions: 94,
    },
  },
};
