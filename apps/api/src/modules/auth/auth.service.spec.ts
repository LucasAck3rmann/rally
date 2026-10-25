// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash } from "@node-rs/argon2";

import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { VerificacaoDeEmailService } from "./verificacao-de-email.service";

describe("AuthService", () => {
  const jwt = { signAsync: jest.fn() } as unknown as JwtService;
  const findUnique = jest.fn();
  const create = jest.fn();
  const prisma = {
    usuario: { findUnique, create },
  } as unknown as PrismaService;
  const enviarVerificacao = jest.fn().mockResolvedValue(undefined);
  const service = new AuthService(prisma, jwt, {
    enviar: enviarVerificacao,
  } as unknown as VerificacaoDeEmailService);

  beforeEach(() => jest.clearAllMocks());

  it("login rejeita credenciais inválidas (usuário inexistente)", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(service.login({ email: "x@y.com", senha: "123456" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("register rejeita e-mail já cadastrado", async () => {
    findUnique.mockResolvedValueOnce({ id: "1" });
    await expect(
      service.register({ nome: "Ana", email: "x@y.com", senha: "123456", aceitouTermos: true }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("o cadastro dispara a verificação de e-mail (RF-03)", async () => {
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({ nome: "Ana", email: "x@y.com", senha: "123456", aceitouTermos: true });

    expect(enviarVerificacao).toHaveBeenCalledWith("u1", "Ana", "x@y.com");
  });

  it("e-mail já cadastrado não dispara verificação nenhuma", async () => {
    findUnique.mockResolvedValueOnce({ id: "1" });

    await expect(
      service.register({ nome: "Ana", email: "x@y.com", senha: "123456", aceitouTermos: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(enviarVerificacao).not.toHaveBeenCalled();
  });

  it("registra quando o consentimento foi dado (RNF-07)", async () => {
    // A coluna existia desde junho e nunca era escrita: a política era
    // aceita na tela e o sistema não guardava prova nenhuma disso — o que é
    // o mesmo que não ter aceite.
    const antes = Date.now();
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({
      nome: "Ana",
      email: "x@y.com",
      senha: "123456",
      aceitouTermos: true,
    });

    const { consentLgpdEm } = create.mock.calls[0][0].data;
    expect(consentLgpdEm).toBeInstanceOf(Date);
    expect(consentLgpdEm.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("a senha vai como resumo, nunca em texto", async () => {
    findUnique.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    await service.register({
      nome: "Ana",
      email: "x@y.com",
      senha: "123456",
      aceitouTermos: true,
    });

    expect(create.mock.calls[0][0].data.senhaHash).not.toBe("123456");
  });

  /**
   * **As três recusas de login dão a mesma resposta, e isso é a proteção.**
   *
   * Dizer qual dos casos ocorreu entrega a quem está adivinhando: "e-mail não
   * existe" confirma quais endereços estão cadastrados, e "esta conta não tem
   * senha" revela que a pessoa entrou por rede social. A suíte cobria só o
   * e-mail inexistente; os outros dois caminhos da condição não eram
   * percorridos por teste nenhum.
   */
  it("conta sem senha não entra por senha, e não diz que não tem senha", async () => {
    // Quem se cadastrou pelo Google ou pelo Instagram não tem `senhaHash`.
    // Sem este ramo, um `null` ali chegaria ao `verify`.
    findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "social@exemplo.com",
      nome: "Ana",
      senhaHash: null,
    });

    await expect(service.login({ email: "social@exemplo.com", senha: "qualquer" })).rejects.toThrow(
      "E-mail ou senha inválidos.",
    );
  });

  it("senha errada dá a mesma recusa que e-mail inexistente", async () => {
    // Hash de verdade, e não dublê: o que está sob teste é a verificação, e
    // um `verify` falsificado passaria mesmo que a chamada estivesse errada.
    const senhaHash = await hash("a-senha-certa");
    findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "x@y.com",
      nome: "Ana",
      senhaHash,
    });

    await expect(service.login({ email: "x@y.com", senha: "a-senha-errada" })).rejects.toThrow(
      "E-mail ou senha inválidos.",
    );
  });

  it("senha certa entra, e o token sai com o usuário", async () => {
    const senhaHash = await hash("a-senha-certa");
    findUnique.mockResolvedValueOnce({
      id: "u1",
      email: "x@y.com",
      nome: "Ana",
      senhaHash,
    });
    (jwt.signAsync as jest.Mock).mockResolvedValueOnce("token-assinado");

    const r = await service.login({ email: "x@y.com", senha: "a-senha-certa" });

    expect(r.accessToken).toBe("token-assinado");
    expect(r.user).toEqual({ id: "u1", nome: "Ana", email: "x@y.com" });
  });

  /**
   * O `me` é lido a cada carregamento da tela de privacidade, e o token vive
   * depois da conta: quem exerce o direito de exclusão (RNF-07) continua com
   * um token válido na mão até ele vencer. A leitura precisa recusar, em vez
   * de devolver `undefined` para a tela montar em cima.
   */
  it("conta apagada recusa, mesmo com token ainda válido", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(service.me("u-apagado")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("me devolve só identificação, e não o resumo da senha", async () => {
    findUnique.mockResolvedValueOnce({ id: "u1", nome: "Ana", email: "x@y.com" });

    expect(await service.me("u1")).toEqual({ id: "u1", nome: "Ana", email: "x@y.com" });
    // O `select` é o que impede o `senhaHash` de sair daqui por acidente.
    expect(findUnique.mock.calls[0][0].select).toEqual({
      id: true,
      nome: true,
      email: true,
    });
  });
});
