// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import type { HelmetOptions } from "helmet";

/**
 * Política de cabeçalhos e de origem da API.
 *
 * Mora aqui, e não dentro do `main.ts`, porque o que está nestas funções são
 * **decisões** e não inicialização: quais origens podem ler a resposta, se o
 * navegador pode adivinhar o tipo do corpo, quem pode embutir a API num
 * quadro. O `main.ts` só as aplica, e por isso fica fora da medição de
 * cobertura — decisão que não é exercitada por nada é decisão que ninguém
 * percebe quando muda.
 */

/** Origem do site, que é a única que precisa ler a resposta pelo navegador. */
export function origemDoSite(): string {
  return process.env.WEB_URL ?? "http://localhost:3000";
}

/**
 * Quem pode ler a resposta da API pelo navegador.
 *
 * Era `enableCors()` sem argumento, que responde `Access-Control-Allow-Origin:
 * *`. Para uma API que autentica por `Authorization`, o curinga não permite
 * credencial — o navegador recusa a combinação —, mas permite **qualquer
 * página ler o corpo** das rotas públicas, e some com a fronteira que torna o
 * resto verificável.
 *
 * Quem fala com a API de verdade são dois, e nenhum depende do curinga:
 *
 * - O **site**, que a chama do servidor (Server Components e Server Actions).
 *   Chamada de servidor não manda `Origin`, então o CORS nem entra; o que
 *   precisa da lista é o que o navegador busca direto, como as fotos em
 *   `/static/`.
 * - O **aplicativo** Flutter, que não é navegador e não está sujeito a CORS.
 *
 * `credentials: true` porque a sessão do painel vai num cookie `httpOnly`, e
 * cookie não atravessa requisição de outra origem sem isto — e **é
 * justamente por isso** que a origem não pode ser curinga: o navegador recusa
 * `*` junto de credencial, e a recusa apareceria como falha sem explicação.
 */
export function opcoesDeCors(): CorsOptions {
  return {
    origin: [origemDoSite()],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

/**
 * Os cabeçalhos que a API passa a mandar.
 *
 * Antes disto a resposta não trazia **nenhum** — nem `nosniff`, nem
 * `Referrer-Policy`, nem HSTS — e anunciava o framework em `X-Powered-By`. O
 * `seguranca-lgpd.md` listava "headers (CSP/helmet)" como item de
 * pré-produção, e a lista estava certa: não havia.
 *
 * As escolhas que fogem do padrão do helmet, e por quê:
 *
 * **`crossOriginResourcePolicy: "cross-origin"`.** O padrão é `same-origin`,
 * que faria o navegador **descartar as fotos das quadras** — a API as serve
 * em `/static/` e o site roda em outra porta. Aqui o compartilhamento é
 * intencional: é imagem pública de vitrine, não dado de titular.
 *
 * **CSP desligada.** A API não serve documento algum: só JSON e imagem, e não
 * há Swagger. CSP governa o que um **documento** pode carregar; numa resposta
 * que não é documento o navegador a ignora. Mandá-la daria a impressão de
 * proteção onde não há superfície para proteger — e a CSP que falta de
 * verdade é a do site, que serve HTML.
 *
 * **HSTS com um ano e subdomínios.** Em `http://localhost` o navegador ignora
 * o cabeçalho, então ele não atrapalha o desenvolvimento; e deixá-lo pronto
 * evita que a primeira subida em produção seja a que esquece dele.
 */
export function opcoesDeHelmet(): HelmetOptions {
  return {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: { maxAge: 60 * 60 * 24 * 365, includeSubDomains: true, preload: false },
  };
}
