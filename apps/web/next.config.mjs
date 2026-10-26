// SPDX-License-Identifier: AGPL-3.0-or-later
/** @type {import('next').NextConfig} */

// As fotos das quadras são servidas pela API (ver apps/api/prisma/seed.ts e, em
// produção, o S3/CloudFront) e o next/image exige host declarado. Declaramos os
// dois endereços possíveis: o público (o que fica gravado na URL do seed) e o
// interno do docker-compose, por onde o otimizador de imagem busca o arquivo.
const origens = [
  process.env.API_PUBLIC_URL ?? "http://localhost:3333",
  process.env.API_URL ?? "http://localhost:3333/api/v1",
].map((valor) => new URL(valor));

const remotePatterns = [];
for (const origem of origens) {
  const chave = `${origem.protocol}//${origem.host}`;
  if (
    remotePatterns.some(
      (p) => `${p.protocol}://${p.hostname}${p.port ? `:${p.port}` : ""}` === chave,
    )
  )
    continue;
  remotePatterns.push({
    protocol: origem.protocol.replace(":", ""),
    hostname: origem.hostname,
    ...(origem.port ? { port: origem.port } : {}),
    pathname: "/static/**",
  });
}

/**
 * Cabeçalhos de segurança do site.
 *
 * Antes disto a resposta do site não trazia **nenhum** e anunciava o
 * framework em `X-Powered-By`. O `seguranca-lgpd.md` listava "headers
 * (CSP/helmet)" como item de pré-produção, e a lista estava certa.
 *
 * A lista mora em `cabecalhosDeSeguranca`, exportada, porque é **decisão** e
 * não configuração de arcabouço: o teste em `src/lib/cabecalhos.spec.ts` a
 * percorre e reprova se um dos cinco sair.
 *
 * **A CSP não está aqui, e isso é deliberado.** O App Router injeta script
 * em linha em cada página — o estado da navegação e os dados do servidor —, e
 * uma CSP sem `nonce` só passa se admitir `'unsafe-inline'` em `script-src`,
 * que é exatamente o que a CSP existe para barrar. A CSP honesta depende de
 * `nonce` por requisição, e `nonce` depende de um `middleware.ts` que o
 * projeto ainda não tem. Até lá o item fica **aberto** no
 * `seguranca-lgpd.md`, com o motivo escrito, em vez de marcado por um
 * cabeçalho que não barra nada.
 */
export const cabecalhosDeSeguranca = [
  // Sem isto o navegador pode **adivinhar** o tipo do corpo. Uma resposta
  // nossa servida como `text/plain` que o navegador decide tratar como HTML
  // executa o que estiver dentro — é o caminho clássico de XSS por upload.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referência completa só dentro do próprio site. Para fora vai a origem, e
  // em texto puro não vai nada: o caminho de uma tela de gestão carrega
  // identificador de estabelecimento e de reserva.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ninguém embute o Rally num quadro. É o que impede clickjacking — a tela
  // de confirmação de reserva sobreposta por outra página, invisível, para o
  // clique cair onde o atacante quer. `frame-ancestors` é a forma moderna, e
  // o `X-Frame-Options` fica pelos navegadores que só entendem ele.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Câmera, microfone e localização não são usados por tela nenhuma. Negar
  // antes é o que faz um script de terceiro, se um dia entrar, não poder
  // pedir permissão em nome do site.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Em `http://localhost` o navegador ignora o HSTS, então ele não atrapalha
  // o desenvolvimento; deixá-lo pronto evita que a primeira subida em
  // produção seja a que esquece dele.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rally/tokens"],
  images: { remotePatterns },
  // Mesma razão do `x-powered-by` da API: anunciar o arcabouço só serve a
  // quem procura a lista de falhas conhecidas dele.
  poweredByHeader: false,
  // O selo de desenvolvimento do Next fica fixo no canto inferior esquerdo e
  // **cobre conteúdo** — atrapalha a inspeção visual das telas e aparece em
  // qualquer captura feita do servidor de desenvolvimento, inclusive nas
  // figuras do relatório. Desligá-lo não afeta produção, onde ele não existe.
  devIndicators: false,
  async headers() {
    return [{ source: "/:caminho*", headers: cabecalhosDeSeguranca }];
  },
};

export default nextConfig;
