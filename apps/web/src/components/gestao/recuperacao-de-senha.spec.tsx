// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvisoDeEnvio, FormularioDeRecuperacao } from "./formulario-de-recuperacao";
import { FormularioDeRedefinicao } from "./formulario-de-redefinicao";

/**
 * As Server Actions não rodam no jsdom. O que se verifica aqui é a **tela**:
 * quais campos existem, o que ela diz e o que ela deixa de dizer — que no
 * caso da recuperação é a parte que mais importa.
 */
vi.mock("@/app/recuperar-senha/acoes", () => ({
  pedirLink: vi.fn(),
  redefinir: vi.fn(),
}));

describe("Formulário de recuperação", () => {
  it("pede só o e-mail", () => {
    render(<FormularioDeRecuperacao />);

    const email = screen.getByLabelText(/e-mail da conta/i);
    expect(email).toHaveAttribute("type", "email");
    expect(email).toBeRequired();
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeInTheDocument();
  });

  it("depois de enviar, não confirma que a conta existe", () => {
    // É a asserção que mais importa nesta tela. A API responde igual para
    // endereço cadastrado e não cadastrado, e a interface não pode desfazer
    // isso dizendo "enviamos para você" — a diferença entre as duas telas
    // seria uma lista de clientes da arena.
    render(<AvisoDeEnvio />);

    expect(screen.getByRole("status")).toHaveTextContent(/se houver conta/i);
    expect(screen.queryByText(/enviamos para você/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/conta encontrada/i)).not.toBeInTheDocument();
  });

  it("diz que o link já enviado continua valendo se pedir de novo", () => {
    // A API tem um intervalo mínimo entre dois envios para o mesmo
    // endereço, e dentro dele não emite token novo nem invalida o anterior.
    // Dizer "invalida o anterior" mandaria a pessoa ignorar o link que
    // funciona.
    render(<AvisoDeEnvio />);
    expect(screen.getByText(/continua valendo/i)).toBeInTheDocument();
  });

  it("oferece a volta para o login", () => {
    render(<FormularioDeRecuperacao />);
    expect(screen.getByRole("link", { name: /lembrei a senha/i })).toHaveAttribute(
      "href",
      "/entrar",
    );
  });
});

describe("Formulário de redefinição", () => {
  it("leva o token em campo oculto, fora do endereço", () => {
    // No endereço, o token entraria no histórico do navegador e no registro
    // do servidor quando o formulário fosse postado.
    const { container } = render(<FormularioDeRedefinicao token="abc123" />);

    const oculto = container.querySelector('input[name="token"]');
    expect(oculto).toHaveAttribute("type", "hidden");
    expect(oculto).toHaveValue("abc123");
  });

  it("pede a senha duas vezes, com o mínimo declarado", () => {
    // Sem a confirmação, a conta sairia com a senha que a pessoa digitou
    // errado sem perceber — e ela só descobriria no login seguinte.
    render(<FormularioDeRedefinicao token="abc123" />);

    const senha = screen.getByLabelText(/^nova senha$/i);
    const repete = screen.getByLabelText(/repita a nova senha/i);

    for (const campo of [senha, repete]) {
      expect(campo).toHaveAttribute("type", "password");
      expect(campo).toHaveAttribute("minLength", "6");
      expect(campo).toBeRequired();
    }
    expect(screen.getByText(/ao menos 6 caracteres/i)).toBeInTheDocument();
  });

  it("usa autocomplete de senha nova, e não da atual", () => {
    // `new-password` é o que faz o gerenciador de senhas oferecer uma nova
    // em vez de preencher a antiga, que é justamente a que não serve aqui.
    render(<FormularioDeRedefinicao token="abc123" />);

    expect(screen.getByLabelText(/^nova senha$/i)).toHaveAttribute("autocomplete", "new-password");
  });

  it("deixa pedir outro link sem voltar ao começo", () => {
    render(<FormularioDeRedefinicao token="abc123" />);
    expect(screen.getByRole("link", { name: /pedir um novo link/i })).toHaveAttribute(
      "href",
      "/recuperar-senha",
    );
  });
});
