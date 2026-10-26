// SPDX-License-Identifier: AGPL-3.0-or-later
import { opcoesDeCors, opcoesDeHelmet, origemDoSite } from "./seguranca";

/**
 * **A política de origem e de cabeçalhos da API.**
 *
 * O que estes testes fixam não é o helmet — biblioteca de terceiro não é o
 * que se testa aqui. São as quatro escolhas que o projeto fez e que o padrão
 * da biblioteca não faria: deixar a foto da quadra atravessar de origem,
 * **não** mandar CSP numa resposta que não é documento, mandar HSTS com um
 * ano, e trocar o curinga do CORS por uma lista.
 *
 * A que mais pede teste é a primeira. O padrão do helmet é
 * `Cross-Origin-Resource-Policy: same-origin`, e com ele o navegador
 * **descarta as fotos das quadras** — a API as serve em `/static/` e o site
 * roda em outra porta. É falha que não aparece em teste de unidade nenhum:
 * a tela carrega, a requisição responde 200, e a imagem simplesmente não
 * pinta.
 */

describe("origemDoSite", () => {
  const antes = process.env.WEB_URL;

  afterEach(() => {
    if (antes === undefined) delete process.env.WEB_URL;
    else process.env.WEB_URL = antes;
  });

  it("usa o endereço do site configurado no ambiente", () => {
    process.env.WEB_URL = "https://rally.app.br";

    expect(origemDoSite()).toBe("https://rally.app.br");
  });

  it("cai no localhost do desenvolvimento quando não há configuração", () => {
    // Sem isto, subir a API sem `.env` daria lista de origens com
    // `undefined` dentro, e o navegador recusaria toda chamada do site sem
    // dizer por quê.
    delete process.env.WEB_URL;

    expect(origemDoSite()).toBe("http://localhost:3000");
  });
});

describe("opcoesDeCors", () => {
  it("troca o curinga por uma lista com o site dentro", () => {
    // Era `enableCors()` sem argumento, que responde
    // `Access-Control-Allow-Origin: *`.
    const opcoes = opcoesDeCors();

    expect(opcoes.origin).toEqual([origemDoSite()]);
    expect(opcoes.origin).not.toBe("*");
  });

  it("admite credencial, que é o que o curinga impedia", () => {
    // A sessão do painel vai num cookie `httpOnly`, e cookie não atravessa
    // requisição de outra origem sem isto. O navegador recusa `*` junto de
    // credencial, de modo que o curinga e a sessão eram incompatíveis.
    expect(opcoesDeCors().credentials).toBe(true);
  });

  it("não admite método que a API não tem", () => {
    const { methods } = opcoesDeCors();

    expect(methods).toEqual(["GET", "POST", "PATCH", "DELETE", "OPTIONS"]);
    expect(methods).not.toContain("PUT");
  });

  it("admite só os dois cabeçalhos que o site manda", () => {
    expect(opcoesDeCors().allowedHeaders).toEqual(["Content-Type", "Authorization"]);
  });
});

describe("opcoesDeHelmet", () => {
  it("deixa a foto da quadra atravessar de origem", () => {
    // O padrão `same-origin` faria o navegador descartar as imagens que a
    // API serve em `/static/` para o site, que roda em outra porta. Aqui o
    // compartilhamento é intencional: é imagem pública de vitrine, não dado
    // de titular.
    expect(opcoesDeHelmet().crossOriginResourcePolicy).toEqual({
      policy: "cross-origin",
    });
  });

  it("não manda CSP, porque a API não serve documento", () => {
    // CSP governa o que um **documento** pode carregar. A API devolve JSON e
    // imagem, e não há Swagger: numa resposta que não é documento o
    // navegador a ignora, e mandá-la daria impressão de proteção onde não há
    // superfície para proteger.
    expect(opcoesDeHelmet().contentSecurityPolicy).toBe(false);
  });

  it("manda HSTS de um ano, com subdomínios e sem preload", () => {
    // `preload` entra numa lista dos navegadores que é **difícil de
    // desfazer**: enquanto o domínio final não está decidido, pedir inclusão
    // é compromisso que não se desfaz num `git revert`.
    expect(opcoesDeHelmet().hsts).toEqual({
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: false,
    });
  });

  it("encurta a referência que sai para fora do site", () => {
    expect(opcoesDeHelmet().referrerPolicy).toEqual({
      policy: "strict-origin-when-cross-origin",
    });
  });
});
