// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * Limites de tentativa nas rotas de autenticação (RNF-06).
 *
 * O RNF-06 promete "OWASP Top 10 mitigado", e a categoria de falhas de
 * identificação e autenticação inclui, explicitamente, ausência de proteção
 * contra tentativa repetida. Até aqui não havia nenhuma: dava para varrer
 * senhas de um e-mail conhecido na velocidade da rede.
 *
 * A rota de recuperação é a mais sensível das cinco, e não por causa de
 * senha: **cada chamada manda um e-mail para o endereço informado**. Sem
 * limite, ela é um amplificador — um laço enche a caixa de entrada de
 * qualquer pessoa, usando o Rally como remetente.
 *
 * ## Uma limitação que precisa ser dita
 *
 * A contagem é por endereço de origem. Isso vale para o **aplicativo**, que
 * fala direto com a API, e para quem chama a API na mão. **Não vale para a
 * web**: as Server Actions rodam no servidor do Next, então todo o tráfego
 * da web chega com o mesmo endereço e divide um balde só.
 *
 * Resolver isso exigiria o Next repassar o endereço real num cabeçalho e a
 * API confiar nele — e confiar em `X-Forwarded-For` sem um proxy de borda
 * que o reescreva cria o buraco que o limite deveria fechar, porque aí
 * qualquer um forja o endereço e escapa. Fica declarado em vez de
 * mal-resolvido; o lugar certo de tratar é o proxy da publicação (marco M5).
 *
 * Por isso os limites da web são generosos o bastante para uso normal
 * compartilhado, e a defesa contra o amplificador de e-mail **não depende
 * deles**: ela está no intervalo mínimo entre dois envios para o mesmo
 * endereço, em `SenhaService`, que vale qualquer que seja a origem.
 */
export const LIMITES = {
  throttlers: [
    {
      // Senha errada repetida. Dez por minuto deixa o humano que errou
      // tentar de novo e torna a varredura inviável.
      name: "login",
      ttl: 60_000,
      limit: 10,
    },
    {
      // Criação de conta em massa.
      name: "cadastro",
      ttl: 60 * 60_000,
      limit: 20,
    },
    {
      // Amplificador de e-mail: o mais apertado dos cinco.
      name: "recuperacao",
      ttl: 15 * 60_000,
      limit: 10,
    },
    {
      // Token de 32 bytes aleatórios não se adivinha por força bruta; o
      // limite existe para o custo da tentativa não ser zero.
      name: "token",
      ttl: 60_000,
      limit: 20,
    },
  ],
  // `satisfies` e nao anotacao: `ThrottlerModuleOptions` e uniao de dois
  // formatos, e anotar apagaria o tipo literal — o teste que confere cada
  // balde deixaria de enxergar `throttlers`.
} satisfies ThrottlerModuleOptions;
