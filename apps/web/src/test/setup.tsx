// SPDX-License-Identifier: AGPL-3.0-or-later
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import type { ImgHTMLAttributes } from "react";

afterEach(cleanup);

// O jsdom não tem matchMedia nem IntersectionObserver, e o framer-motion usa os
// dois (prefers-reduced-motion e whileInView). Sem estes dois stubs nenhum
// componente com animação renderiza no teste.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: number[] = [];
}

// Atribuição direta, e não `vi.stubGlobal`: um `vi.unstubAllGlobals()` em
// qualquer teste levaria o stub junto, e o next/link quebraria no prefetch.
globalThis.IntersectionObserver =
  IntersectionObserverStub as unknown as typeof IntersectionObserver;

// O next/image depende do pipeline de imagens do Next; no teste interessa só o
// `alt` e o `src`, então ele vira um `img` comum.
type PropsDaImagem = ImgHTMLAttributes<HTMLImageElement> & {
  src: string | { src: string };
  alt: string;
};

vi.mock("next/image", () => ({
  default: ({ src, alt }: PropsDaImagem) => (
    <img src={typeof src === "string" ? src : src.src} alt={alt} />
  ),
}));

// Os ganchos de navegação do Next leem o contexto da requisição, que não
// existe fora do servidor — sem eles a barra lateral não renderiza em teste
// nenhum. Fica aqui, e não repetido em cada spec, pela mesma razão do
// next/image acima: é limitação do arcabouço, não escolha de cada teste.
//
// `usePathname` devolve uma rota de gestão **que não é a de privacidade**,
// para que o estado "página atual" seja exercitado pela ausência e os testes
// que o queiram marquem o caminho por conta própria.
vi.mock("next/navigation", () => ({
  usePathname: () => "/gestao/e1",
  useParams: () => ({ estabelecimentoId: "e1" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
