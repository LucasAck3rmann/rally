// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RegistroDaTrilha } from "@/lib/gestao/contratos";
import { TrilhaDaArena, filtrar, resumoDosDados, simples } from "./trilha";

function registro(opcoes: Partial<RegistroDaTrilha> = {}): RegistroDaTrilha {
  return {
    id: "a1",
    acao: "pausar quadra",
    entidade: "Quadra",
    entidadeId: "q1",
    dados: { ativo: false },
    criadoEm: "2026-10-15T13:00:00.000Z",
    autor: { id: "u1", nome: "Lucas Ackermann" },
    ...opcoes,
  };
}

function montar(
  trilha: RegistroDaTrilha[],
  filtro: Parameters<typeof filtrar>[1] = {},
  teto = 100,
) {
  render(<TrilhaDaArena trilha={trilha} estabelecimentoId="e1" filtro={filtro} teto={teto} />);
}

describe("simples", () => {
  it("dobra acento e caixa", () => {
    expect(simples("Conciliação")).toBe("conciliacao");
    expect(simples("  Promoção  ")).toBe("promocao");
    expect(simples("Augusto Boff")).toBe("augusto boff");
  });
});

describe("filtrar", () => {
  const trilha = [
    registro({ id: "a1", acao: "pausar quadra", entidade: "Quadra" }),
    registro({
      id: "a2",
      acao: "expirar pendentes",
      entidade: "Pagamento",
      entidadeId: null,
      autor: { id: "u2", nome: "Augusto Boff" },
    }),
    registro({
      id: "a3",
      // **O acento desta ação não tem sósia sem acento em nenhum outro campo
      // do registro**, e é isso que faz o teste de dobra de acento valer. A
      // primeira versão usava "criar promoção" com entidade `Promocao`:
      // buscar "promocao" casava com o nome da entidade, e o teste passava
      // mesmo sem dobra nenhuma. Passava pelo motivo errado, que é o defeito
      // que a mutação acha e a leitura não.
      acao: "liberar horário",
      entidade: "Promocao",
      entidadeId: "c7",
    }),
  ];

  it("sem filtro devolve tudo — e não zero", () => {
    // O engano fácil aqui é tratar busca vazia como "não casa com nada", e a
    // tela abriria vazia no primeiro acesso, que é o acesso que importa.
    expect(filtrar(trilha, {}).map((r) => r.id)).toEqual(["a1", "a2", "a3"]);
    expect(filtrar(trilha, { busca: "   " }).map((r) => r.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("acha sem acento o que foi escrito com acento", () => {
    // **É o defeito que nenhuma inspeção visual pega.** Ninguém digita
    // "horário" com acento numa caixa de busca, e sem dobrar o acento a
    // trilha responde "nenhum registro" sobre um registro que está ali.
    expect(filtrar(trilha, { busca: "horario" }).map((r) => r.id)).toEqual(["a3"]);
    expect(filtrar(trilha, { busca: "HORARIO" }).map((r) => r.id)).toEqual(["a3"]);
    // E quem digita com acento também acha: dobrar os dois lados, e não só o
    // da busca, é o que faz as duas direções funcionarem.
    expect(filtrar(trilha, { busca: "horário" }).map((r) => r.id)).toEqual(["a3"]);
  });

  it("busca pelo nome de quem fez", () => {
    expect(filtrar(trilha, { busca: "augusto" }).map((r) => r.id)).toEqual(["a2"]);
  });

  it("busca pelo identificador, que é como se chega de outra tela", () => {
    expect(filtrar(trilha, { busca: "q1" }).map((r) => r.id)).toEqual(["a1"]);
  });

  it("ação de sistema é alcançada pela palavra sistema", () => {
    // Autor nulo é ação de sistema, e a tela escreve "Sistema". Se a busca não
    // enxergasse isso, o que a tela mostra não seria filtrável pelo que mostra.
    const comSistema = [...trilha, registro({ id: "a4", autor: null })];
    expect(filtrar(comSistema, { busca: "sistema" }).map((r) => r.id)).toEqual(["a4"]);
  });

  it("entidade é casamento exato, não trecho", () => {
    expect(filtrar(trilha, { entidade: "Quadra" }).map((r) => r.id)).toEqual(["a1"]);
    expect(filtrar(trilha, { entidade: "Promocao" }).map((r) => r.id)).toEqual(["a3"]);
  });

  it("os dois filtros juntos são E, e não OU", () => {
    // Composição de filtro é onde o erro passa: um `||` aqui devolveria tudo
    // de Quadra **mais** tudo que casa a busca, e a tela pareceria funcionar.
    expect(filtrar(trilha, { busca: "pausar", entidade: "Quadra" }).map((r) => r.id)).toEqual([
      "a1",
    ]);
    expect(filtrar(trilha, { busca: "pausar", entidade: "Pagamento" })).toEqual([]);
  });
});

describe("resumoDosDados", () => {
  it("resume o primeiro nível em texto legível", () => {
    expect(resumoDosDados({ ativo: false, nome: "Quadra 2" })).toBe(
      "ativo: false · nome: Quadra 2",
    );
  });

  it("não é nada quando não há nada a dizer", () => {
    expect(resumoDosDados(null)).toBeNull();
    expect(resumoDosDados(undefined)).toBeNull();
    expect(resumoDosDados({})).toBeNull();
    expect(resumoDosDados("texto solto")).toBeNull();
    expect(resumoDosDados([1, 2])).toBeNull();
    expect(resumoDosDados({ nome: null, descricao: "" })).toBeNull();
  });

  it("não desce em objeto aninhado, e isso espelha a garantia da API", () => {
    // O `AuditoriaInterceptor` remove campo sensível **um nível adentro**.
    // Expandir o segundo nível aqui mostraria exatamente a profundidade que
    // ninguém limpou — a tela mostra tanto quanto a remoção alcança.
    const resumo = resumoDosDados({
      nome: "Quadra 2",
      credenciais: { senha: "sopadeletra" },
    });
    expect(resumo).toBe("nome: Quadra 2 · credenciais: …");
    expect(resumo).not.toContain("sopadeletra");
  });

  it("encurta texto longo em vez de esticar a linha", () => {
    const resumo = resumoDosDados({ descricao: "a".repeat(80) });
    expect(resumo).toContain("…");
    expect(resumo!.length).toBeLessThan(70);
  });

  it("conta itens de lista em vez de despejá-los", () => {
    expect(resumoDosDados({ comodidades: ["Vestiário", "Bar"] })).toBe("comodidades: 2 itens");
    expect(resumoDosDados({ comodidades: ["Bar"] })).toBe("comodidades: 1 item");
  });
});

describe("TrilhaDaArena", () => {
  it("trilha vazia explica quando ela começa, e não mostra filtro", () => {
    montar([]);
    expect(screen.getByText(/Nada registrado ainda/)).toBeInTheDocument();
    // Filtrar o vazio não é uma operação: o controle só confundiria.
    expect(screen.queryByLabelText(/Buscar por ação/)).not.toBeInTheDocument();
  });

  it("filtro sem resultado é mensagem diferente de trilha vazia", () => {
    // **Confundir as duas é o defeito.** O dono que digita um nome errado
    // concluiria que a auditoria não está registrando nada.
    montar([registro()], { busca: "inexistente" });
    expect(screen.queryByText(/Nada registrado ainda/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum registro para esse filtro/)).toBeInTheDocument();
    expect(screen.getByText(/A trilha tem 1 no/)).toBeInTheDocument();
  });

  it("mostra quem fez o quê, com entidade e identificador", () => {
    montar([registro()]);
    expect(screen.getByText("Lucas Ackermann")).toBeInTheDocument();
    expect(screen.getByText(/pausar quadra/)).toBeInTheDocument();
    expect(screen.getByText(/Quadra · q1/)).toBeInTheDocument();
    expect(screen.getByText("ativo: false")).toBeInTheDocument();
  });

  it("ação sem autor aparece como Sistema", () => {
    montar([registro({ autor: null })]);
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });

  it("a hora vai no atributo dateTime, legível por máquina", () => {
    montar([registro()]);
    // O texto depende do fuso de quem roda o teste; o atributo não, e é o que
    // um leitor de tela e um script de exportação consultam.
    const hora = screen.getByText(/^\d{2}:\d{2}$/);
    expect(hora).toHaveAttribute("dateTime", "2026-10-15T13:00:00.000Z");
  });

  it("as opções de entidade saem dos dados, sem repetir", () => {
    montar([
      registro({ id: "a1", entidade: "Quadra" }),
      registro({ id: "a2", entidade: "Quadra" }),
      registro({ id: "a3", entidade: "Reserva" }),
    ]);
    const seletor = screen.getByLabelText("Entidade");
    const opcoes = within(seletor).getAllByRole("option");
    expect(opcoes.map((o) => o.textContent)).toEqual(["Todas", "Quadra", "Reserva"]);
  });

  it("conta quantos de quantos, e declara o teto quando bate nele", () => {
    const cheia = Array.from({ length: 3 }, (_, i) => registro({ id: `a${i}` }));
    montar(cheia, {}, 3);
    expect(screen.getByText(/3 de 3 registros/)).toBeInTheDocument();
    expect(screen.getByText(/mostrando os 3 mais recentes/)).toBeInTheDocument();
  });

  it("abaixo do teto não promete nem oferece mais", () => {
    montar([registro()], {}, 100);
    expect(screen.queryByText(/mais recentes/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ver 500" })).not.toBeInTheDocument();
  });

  it("o link de ver 500 preserva o filtro em vigor", () => {
    // Trocar o limite jogando o filtro fora obrigaria a redigitar a busca, e é
    // o erro clássico de composição de parâmetro.
    montar([registro()], { busca: "pausar", entidade: "Quadra" }, 1);
    const link = screen.getByRole("link", { name: "ver 500" });
    expect(link).toHaveAttribute(
      "href",
      "/gestao/e1/auditoria?busca=pausar&entidade=Quadra&limite=500",
    );
  });

  it("limpar descarta a busca mas mantém o limite pedido", () => {
    montar([registro()], { busca: "pausar", limite: 500 }, 500);
    expect(screen.getByRole("link", { name: "Limpar" })).toHaveAttribute(
      "href",
      "/gestao/e1/auditoria?limite=500",
    );
  });

  it("sem filtro não existe o que limpar", () => {
    montar([registro()]);
    expect(screen.queryByRole("link", { name: "Limpar" })).not.toBeInTheDocument();
  });

  it("o formulário é GET para a própria rota, e funciona sem JavaScript", () => {
    // Mesma escolha dos filtros públicos: cada filtro vira uma URL que dá para
    // guardar, e a tela não depende de hidratação para filtrar.
    montar([registro()]);
    const formulario = screen.getByRole("search");
    expect(formulario).toHaveAttribute("method", "get");
    expect(formulario).toHaveAttribute("action", "/gestao/e1/auditoria");
  });

  it("declara que a trilha é de melhor esforço", () => {
    // A §5.1 do relatório se apoia nesta trilha. Se a tela não disser que ela
    // pode ter buraco, a afirmação do relatório fica mais forte que o sistema.
    montar([registro()]);
    expect(screen.getByText(/melhor esforço/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum registro é apagado ou editado/)).toBeInTheDocument();
  });
});
