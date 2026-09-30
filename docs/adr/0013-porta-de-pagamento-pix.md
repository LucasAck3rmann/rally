# ADR-0013 — Pagamento Pix atrás de uma porta

**Status:** Aceito · **Data:** 2026-09-02 · **Decisores:** Lucas (tech lead)
**Relacionado:** [ADR-0003 — AbacatePay como gateway](README.md#adr-0003--abacatepay-como-gateway-de-pagamento) · [ADR-0012 — Captação de replays por parceria](0012-replays-por-parceria.md) · [Fundamentação Teórica e Padrões](../fundamentacao.md) · [Requisitos](../requisitos.md) (RF-12, RF-13)

## Contexto

O [ADR-0003](README.md#adr-0003--abacatepay-como-gateway-de-pagamento) escolheu a **AbacatePay** como gateway e já previa isolá-la atrás de um _Adapter_. Faltava decidir **quando** construir esse isolamento — e o cronograma forçou a resposta.

O fluxo do cliente (RF-12) precisava rodar ponta a ponta para o TCC: buscar quadra → escolher horário → reservar → **pagar** → confirmar. Mas a integração real com a AbacatePay depende de **credenciais e contrato comercial**, que não estavam disponíveis e não dependiam do desenvolvimento. Esperar por elas significaria deixar a metade mais visível do produto sem poder ser demonstrada nem testada.

### Forças

- O checkout precisa existir e ser **demonstrável** antes de haver gateway.
- A troca de gateway é um risco real: a AbacatePay é menos madura que as alternativas, e Mercado Pago, Asaas e Pagar.me seguem como plano B ([ADR-0003](README.md#adr-0003--abacatepay-como-gateway-de-pagamento)).
- O código de pagamento não pode virar refém de um fornecedor: RF-13 (webhook assinado e idempotente) entra depois, sem reescrever o domínio.
- O que o app mostra — QR e "copia e cola" — precisa ser **real o bastante** para validar a interface, mesmo sem movimentar dinheiro.

## Opções consideradas

### A) Esperar as credenciais e integrar direto

Escrever o checkout já chamando a AbacatePay.

- **Prós:** um caminho só, sem código descartável.
- **Contras:** trava a entrega mais visível do MVP numa dependência externa e fora do controle do projeto. Amarra o domínio ao formato de um fornecedor específico logo na primeira versão — e é justamente o fornecedor com maior chance de troca.

### B) Simular o pagamento na tela (mock no app)

O app finge que pagou, sem nada no servidor.

- **Prós:** rapidíssimo.
- **Contras:** não exercita nada do que importa — a reserva não muda de estado, o servidor não valida, e a tela do Pix mostraria um QR falso. Demonstraria a aparência do fluxo, não o fluxo.

### C) **Porta no domínio + adaptador de desenvolvimento** _(escolhida)_

Uma interface `PixProvider` no domínio de pagamentos, com o `PixDevProvider` respondendo por ela até a AbacatePay entrar.

- **Prós:** o fluxo roda de verdade — a reserva muda de estado, o servidor valida, a cobrança tem número e expiração. O gateway vira detalhe de infraestrutura, substituível trocando um `useClass`. É _Ports & Adapters_ aplicado no ponto onde a volatilidade é maior.
- **Contras:** o provedor de desenvolvimento é código que não vai para produção — e, se vazar para lá, seria um caminho de pagamento falso num sistema real.

## Decisão

Pagamento Pix atrás da porta `PixProvider`, injetada por token (`PIX_PROVIDER`). O `PixDevProvider` responde por ela em desenvolvimento; a AbacatePay entra como outro adaptador, sem tocar no domínio.

O provedor de desenvolvimento **gera um BR Code válido de verdade** — payload EMV com CRC-16/CCITT-FALSE, conforme o _Manual de Padrões para Iniciação do Pix_ do Banco Central. Não é um texto qualquer: é um código que um aplicativo de banco consegue ler. Isso mantém honesta a tela do Pix, que desenha o QR a partir do copia e cola.

O que ele **não** faz: não movimenta dinheiro e não recebe webhook. A confirmação em desenvolvimento é um endpoint explícito de simulação, **bloqueado fora de desenvolvimento** por checagem de `NODE_ENV` — e essa trava é coberta por teste, porque é a única coisa que separa um atalho de desenvolvimento de uma falha grave de segurança.

## Consequências

**Positivas**

- O checkout ficou pronto, demonstrável e testado meses antes de existir contrato com gateway.
- A troca de fornecedor custa um `useClass` — o plano B do ADR-0003 deixou de ser teórico.
- A geração do BR Code virou código do projeto, com teste próprio, em vez de responsabilidade do gateway. Serve a qualquer provedor.

**Negativas**

- Existe no repositório um caminho que cria cobrança sem gateway. Mitigado pela trava de ambiente e pelo teste que a cobre, mas é dívida que só some quando a AbacatePay entrar.
- A porta foi desenhada a partir do que o Pix exige, não da API real da AbacatePay. É provável que precise de ajuste na integração — o risco é pequeno porque a superfície é mínima (uma operação), mas existe.
- RF-13 (webhook assinado e idempotente) continua aberto: hoje não há verificação de assinatura nenhuma, porque não há o que assinar.

## Implementação

- Porta: `apps/api/src/modules/pagamentos/pix-provider.ts` — `PixProvider`, `CobrancaPix`, `CriarCobrancaPix` e o token `PIX_PROVIDER`.
- Adaptador de desenvolvimento: `pix-dev.provider.ts`.
- Geração do BR Code: `br-code.ts`, com teste em `br-code.spec.ts`.
- Ligação: `pagamentos.module.ts` (`{ provide: PIX_PROVIDER, useClass: PixDevProvider }`) — é esta linha que muda quando a AbacatePay entrar.

## Quando revisitar

Ao integrar a AbacatePay (RF-13). Nessa hora: escrever o adaptador de produção, trocar o `useClass`, remover o endpoint de simulação e acrescentar a verificação de assinatura e a idempotência do webhook. Se a API real exigir campos que a porta não tem, o ajuste da interface entra no mesmo PR — e este ADR ganha um adendo em vez de um substituto, porque a decisão de _ter_ a porta não muda.
