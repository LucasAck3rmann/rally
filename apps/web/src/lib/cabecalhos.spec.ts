// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

// O `next.config.mjs` é importado de propósito, e não copiado: o teste tem de
// ler **o que o site serve**, não uma segunda lista mantida em acordo à mão.
import configuracao, { cabecalhosDeSeguranca } from "../../next.config.mjs";

/**
 * **Os cabeçalhos de segurança do site.**
 *
 * Medido em 25/10, antes disto: a resposta de `http://localhost:3000/` não
 * trazia **nenhum** cabeçalho de segurança, e trazia `X-Powered-By: Next.js`.
 * O `seguranca-lgpd.md` listava "headers (CSP/helmet)" como item de
 * pré-produção, e a lista estava certa — não havia.
 *
 * O teste importa o `next.config.mjs` de verdade em vez de repetir a lista.
 * Repetir criaria duas fontes sobre a mesma regra, e a segunda passaria a
 * reprovar por desacordo em vez de por falha — foi a lição do
 * `packages/shared` (ADR-0017).
 *
 * O que se verifica é **correspondência**, não tamanho: cada cabeçalho é
 * procurado pelo nome e o valor é comparado. Um teste que só contasse seis
 * entradas passaria com seis cabeçalhos errados.
 */

function valorDe(nome: string): string | undefined {
  return cabecalhosDeSeguranca.find(
    (c: { key: string }) => c.key.toLowerCase() === nome.toLowerCase(),
  )?.value;
}

describe("cabeçalhos de segurança do site", () => {
  it("impede o navegador de adivinhar o tipo do corpo", () => {
    // Uma resposta nossa servida como `text/plain` que o navegador decide
    // tratar como HTML executa o que estiver dentro.
    expect(valorDe("X-Content-Type-Options")).toBe("nosniff");
  });

  it("encurta a referência que sai do site", () => {
    // O caminho de uma tela de gestão carrega identificador de
    // estabelecimento e de reserva; ele não vai para fora inteiro.
    expect(valorDe("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("recusa ser embutido num quadro, pelas duas formas", () => {
    // É o que impede clickjacking: a tela de confirmação de reserva
    // sobreposta por outra página, invisível, para o clique cair onde o
    // atacante quer. `frame-ancestors` é a forma moderna; o
    // `X-Frame-Options` fica pelos navegadores que só entendem ele.
    expect(valorDe("X-Frame-Options")).toBe("DENY");
    expect(valorDe("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("nega câmera, microfone e localização", () => {
    const politica = valorDe("Permissions-Policy") ?? "";

    for (const recurso of ["camera", "microphone", "geolocation"]) {
      expect(politica).toContain(`${recurso}=()`);
    }
  });

  it("manda HSTS de um ano com subdomínios", () => {
    const hsts = valorDe("Strict-Transport-Security") ?? "";

    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
    // `preload` entra numa lista dos navegadores que é difícil de desfazer:
    // enquanto o domínio final não está decidido, é compromisso que não se
    // desfaz num `git revert`.
    expect(hsts).not.toContain("preload");
  });

  it("a CSP do site **não** admite script em linha", () => {
    // O item que fica aberto no `seguranca-lgpd.md`. A CSP daqui cobre só
    // `frame-ancestors`, de propósito: o App Router injeta script em linha em
    // cada página, e uma CSP sem `nonce` só passaria admitindo
    // `'unsafe-inline'` em `script-src` — que é exatamente o que a CSP existe
    // para barrar. Este teste existe para que ninguém "complete" a CSP por
    // esse caminho sem que algo reprove.
    const csp = valorDe("Content-Security-Policy") ?? "";

    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("configuração do site", () => {
  it("não anuncia o arcabouço", () => {
    expect(configuracao.poweredByHeader).toBe(false);
  });

  it("aplica os cabeçalhos a toda rota, e não só à raiz", async () => {
    // `/:caminho*` e não `/`: a tela de gestão e as rotas de arquivo são
    // justamente as que carregam dado de titular.
    const regras = await configuracao.headers();

    expect(regras).toHaveLength(1);
    expect(regras[0].source).toBe("/:caminho*");
    expect(regras[0].headers).toBe(cabecalhosDeSeguranca);
  });
});
