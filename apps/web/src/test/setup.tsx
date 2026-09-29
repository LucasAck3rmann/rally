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

vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

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
