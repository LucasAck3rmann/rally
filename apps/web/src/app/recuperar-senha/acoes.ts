// SPDX-License-Identifier: AGPL-3.0-or-later
"use server";

import { redirect } from "next/navigation";

import { baseDaApi } from "@/lib/api/client";

export type EstadoDaRecuperacao = { erro?: string; enviado?: boolean };
export type EstadoDaRedefinicao = { erro?: string };

/**
 * Pede o link de redefinição (RF-03).
 *
 * Roda **no servidor**, como o login, pelo mesmo motivo: o endereço digitado
 * não precisa passar pelo JavaScript da página, e a chamada à API sai de um
 * lugar onde a origem é conhecida.
 *
 * A resposta é sempre a mesma, exista ou não a conta — a API já responde
 * assim, e a tela não pode desfazer isso mostrando um erro quando o endereço
 * não existe. A diferença entre as duas telas seria uma lista de clientes.
 */
export async function pedirLink(
  _anterior: EstadoDaRecuperacao,
  dados: FormData,
): Promise<EstadoDaRecuperacao> {
  const email = String(dados.get("email") ?? "").trim();
  if (!email) return { erro: "Informe o e-mail da conta." };

  let resposta: Response;
  try {
    resposta = await fetch(`${baseDaApi()}/auth/recuperar-senha`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {
    return { erro: "A API do Rally não respondeu. Tente de novo." };
  }

  // 400 aqui é formato de e-mail inválido, que o próprio campo já barra; e
  // qualquer outra falha não pode virar "esse e-mail não existe".
  if (!resposta.ok && resposta.status === 400) {
    return { erro: "Informe um e-mail válido." };
  }
  // 429 é o limite de tentativas da API, e merece dizer o que fazer: "tente
  // de novo" é justamente o que não resolve.
  if (resposta.status === 429) {
    return { erro: "Muitas tentativas. Aguarde alguns minutos." };
  }
  if (!resposta.ok) {
    return { erro: "Não foi possível enviar agora. Tente de novo." };
  }

  return { enviado: true };
}

/** Conclui a redefinição com o token que veio no link (RF-03). */
export async function redefinir(
  _anterior: EstadoDaRedefinicao,
  dados: FormData,
): Promise<EstadoDaRedefinicao> {
  const token = String(dados.get("token") ?? "");
  const senha = String(dados.get("senha") ?? "");
  const confirmacao = String(dados.get("confirmacao") ?? "");

  if (!token) return { erro: "Link inválido. Peça um novo." };
  if (senha.length < 6) {
    return { erro: "A senha precisa de ao menos 6 caracteres." };
  }
  // Conferido aqui e não só no navegador: o formulário continua funcionando
  // sem JavaScript, e sem esta checagem a conta sairia com a senha que a
  // pessoa digitou errado nos dois campos sem perceber.
  if (senha !== confirmacao) {
    return { erro: "As duas senhas não são iguais." };
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${baseDaApi()}/auth/redefinir-senha`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token, senha }),
    });
  } catch {
    return { erro: "A API do Rally não respondeu. Tente de novo." };
  }

  // 429 aqui também, e antes do repasse: a recusa do limitador vem com a
  // mensagem do framework, em inglês, e repassá-la mostraria
  // "ThrottlerException: Too Many Requests" a quem está redefinindo a senha.
  // O balde desta rota é o mesmo do login, de um minuto.
  if (resposta.status === 429) {
    return { erro: "Muitas tentativas. Aguarde um minuto e tente de novo." };
  }
  if (!resposta.ok) {
    // A API distingue inválido, já usado e vencido, e a mensagem dela é a
    // que diz o que fazer. Trocar por um texto genérico aqui apagaria
    // justamente a parte útil.
    const corpo = (await resposta.json().catch(() => null)) as
      | { message?: string | string[] }
      | null;
    const mensagem = Array.isArray(corpo?.message)
      ? corpo.message[0]
      : corpo?.message;
    return { erro: mensagem ?? "Não foi possível redefinir. Peça um novo link." };
  }

  // Leva para o login já com o aviso: deixar a pessoa numa tela de sucesso
  // sem saída a obrigaria a procurar sozinha onde entrar com a senha nova.
  redirect("/entrar?senha=redefinida");
}
