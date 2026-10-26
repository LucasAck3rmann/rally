// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EstabelecimentoGerido, Papel } from "@/lib/gestao/contratos";
import { BarraLateral } from "./barra-lateral";

/**
 * **A barra lateral não tinha teste até a trilha de auditoria entrar**, e é
 * por isso que ele nasce aqui: a trilha é a primeira seção cuja *leitura* é
 * restrita, de modo que a barra passou a decidir o que mostrar — antes dela
 * toda seção era de quem tem vínculo e a lista era igual para todos.
 *
 * Um link visível para uma tela que recusa é pior que link ausente: ele
 * promete e nega. O `PapelGuard` da API continua sendo quem autoriza; estes
 * testes cobrem só a promessa que a interface faz.
 */

function arena(opcoes: Partial<EstabelecimentoGerido> = {}): EstabelecimentoGerido {
  return {
    // `e1` porque é o que o `useParams` mocado devolve no setup: é este o
    // estabelecimento que a barra considera o atual.
    id: "e1",
    nome: "Arena Beira-Rio",
    slug: "arena-beira-rio",
    cidade: "Sapiranga",
    uf: "RS",
    plano: "PRO",
    ativo: true,
    quadras: 3,
    meuPapel: "ADMIN",
    ...opcoes,
  };
}

function montar(papel: Papel) {
  render(<BarraLateral estabelecimentos={[arena({ meuPapel: papel })]} />);
}

const SEM_AUDITORIA: Papel[] = ["ATENDENTE", "FINANCEIRO", "MANTENEDOR"];

describe("BarraLateral", () => {
  it("o administrador alcança a trilha de auditoria", () => {
    montar("ADMIN");
    expect(screen.getByRole("link", { name: "Auditoria" })).toHaveAttribute(
      "href",
      "/gestao/e1/auditoria",
    );
  });

  it.each(SEM_AUDITORIA)("%s não vê a trilha de auditoria", (papel) => {
    montar(papel);
    expect(screen.queryByRole("link", { name: "Auditoria" })).not.toBeInTheDocument();
  });

  it.each(SEM_AUDITORIA)("%s continua vendo o resto do painel", (papel) => {
    // **Âncora.** Sem ela, um filtro que escondesse *tudo* passaria no teste
    // acima — e a suíte estaria provando o contrário do que promete. Foi a
    // lição da varredura vazia no teste da trilha na API.
    montar(papel);
    for (const secao of [
      "Painel",
      "Agenda",
      "Quadras",
      "Relatórios",
      "Cupons",
      "Conciliação",
      "Equipe",
    ]) {
      expect(screen.getByRole("link", { name: secao })).toBeInTheDocument();
    }
  });

  it("MANTENEDOR não é papel de arena, e a barra trata assim", () => {
    // O `PAPEIS_DE_GESTAO` da API **não** inclui `MANTENEDOR`: é papel da
    // plataforma, e o guard o recusa em toda rota de estabelecimento. Já foi a
    // causa de quatro páginas escreverem a regra errada do mesmo jeito.
    montar("MANTENEDOR");
    expect(screen.getByText("Mantenedor")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Auditoria" })).not.toBeInTheDocument();
  });

  it("com uma arena só, não há seletor — escolher entre uma não é escolher", () => {
    render(<BarraLateral estabelecimentos={[arena()]} />);
    expect(screen.getByText("Arena Beira-Rio")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Arena Beira-Rio" })).not.toBeInTheDocument();
  });

  it("com duas, o seletor aparece e leva a cada uma", () => {
    render(
      <BarraLateral estabelecimentos={[arena(), arena({ id: "e2", nome: "Arena Sapiranga" })]} />,
    );
    expect(screen.getByRole("link", { name: "Arena Sapiranga" })).toHaveAttribute(
      "href",
      "/gestao/e2",
    );
  });

  it("sem nenhuma arena, a conta continua alcançável", () => {
    // Fora do condicional de propósito: o direito sobre os próprios dados é da
    // pessoa e não da arena (LGPD, RF-34). Quem ainda não gerencia nada também
    // precisa chegar à privacidade e conseguir sair.
    render(<BarraLateral estabelecimentos={[]} />);
    expect(screen.getByText(/ainda não gerencia nenhuma arena/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacidade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Painel" })).not.toBeInTheDocument();
  });

  it("marca a página atual para quem navega por teclado e leitor de tela", () => {
    // O setup mocka `usePathname` em `/gestao/e1`, que é o Painel.
    montar("ADMIN");
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Agenda" })).not.toHaveAttribute("aria-current");
  });
});
