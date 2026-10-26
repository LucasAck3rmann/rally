// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Percorre as seis tarefas do Instrumento III contra a API, e desfaz o que
 * criou.
 *
 *   node tools/ensaio-do-piloto.mjs
 *
 * **O dia do teste de usabilidade é o único do projeto que não se repete.**
 * São cinco participantes e uma data; se o ambiente quebrar, não há segunda
 * execução — e o cronograma registra isso como o risco que não se recupera
 * trabalhando mais. O piloto com uma pessoa de fora existe para gastar o
 * risco antes, e esta ferramenta é a metade dele que não precisa de gente.
 *
 * Ela não testa a interface: as tarefas são do participante, no aparelho, e é
 * disso que o ensaio de novembro trata. Ela testa a **pré-condição** de cada
 * tarefa — que os dados do *seed* sustentem o que o roteiro pede. Nenhuma
 * tarefa do roteiro é sobre a API, e todas dependem dela:
 *
 * | Tarefa | A pré-condição que esta ferramenta mede |
 * | --- | --- |
 * | T1 "crie uma conta" | o cadastro **abre sessão**, sem passo de verificação |
 * | T2 "ache uma quadra de futevôlei" | o filtro de modalidade devolve quadra |
 * | T3 "reserve amanhã às 19h" | o horário está livre, dentro da antecedência |
 * | T4 "pague com Pix" | o provedor devolve copia e cola |
 * | T5 "confira a reserva" | ela aparece em "minhas reservas" |
 * | T6 "cancele" | o cancelamento é aceito |
 *
 * **Desfaz no fim, e é por isso que pode rodar na véspera.** A T3 ocupa
 * justamente o horário que a sessão vai usar: deixá-lo reservado faria o
 * participante encontrar "indisponível" e falhar a tarefa por causa do
 * ensaio. O cancelamento devolve o horário, e a última linha confere que
 * devolveu.
 *
 * **Duas armadilhas que este roteiro já pagou**, e por isso estão escritas:
 *
 * 1. O cadastro exige `aceitouTermos: true`. Sem ele a resposta é 400 com a
 *    mensagem da política de privacidade, e não "senha fraca" nem nada que
 *    pareça com o que o participante fez.
 * 2. O filtro de modalidade casa pelo **nome exibido** (`"Futevôlei"`), e não
 *    pelo valor do enum do esquema (`FUTEVOLEI`). A primeira versão desta
 *    ferramenta mandava o enum, recebia zero quadras e **acusou um defeito
 *    que não existe** — o chip da tela devolve o nome que a própria API
 *    mandou, de modo que ele fecha. Ficou como caso do próprio ensaio.
 */

const API = process.env.API_URL ?? "http://localhost:3333/api/v1";

/** A quadra do *seed* usada no roteiro; trocável por argumento. */
const QUADRA = process.argv[2] ?? "cmveoyxbn000cvwak18rt7rvw";

let falhas = 0;

function ok(tarefa, texto) {
  console.log(`  ok     ${tarefa}  ${texto}`);
}

function falha(tarefa, texto) {
  falhas += 1;
  console.log(`  FALHA  ${tarefa}  ${texto}`);
}

async function chamar(caminho, { metodo = "GET", corpo, token } = {}) {
  let resposta;
  try {
    resposta = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: {
        Accept: "application/json",
        ...(corpo ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch (causa) {
    // **API fora do ar estoura no `fetch`, antes de haver status.** A
    // primeira versão desta ferramenta não tratava isso e despejava a pilha
    // do Node — que é a pior resposta possível na véspera de uma sessão,
    // porque esconde a única informação útil: o servidor não está no ar.
    return { status: 0, dados: null, semResposta: String(causa?.message ?? causa) };
  }
  const texto = await resposta.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = { naoEraJson: texto.slice(0, 200) };
  }
  return { status: resposta.status, dados };
}

/** Lista de quadras, tolerando resposta em lista ou embrulhada. */
function comoLista(dados) {
  if (Array.isArray(dados)) return dados;
  return dados?.itens ?? dados?.dados ?? [];
}

/** O dia seguinte em `YYYY-MM-DD`, que é o que o roteiro pede. */
function amanha() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function horarioLivre(data, hora) {
  const { dados } = await chamar(`/quadras/${QUADRA}/disponibilidade?data=${data}`);
  const slots = dados?.slots ?? comoLista(dados);
  const achado = slots.find((s) => String(s.inicio ?? "").slice(11, 16) === hora);
  // `?? null` e não `?? false`: "não achei o slot" não é "está ocupado", e
  // confundir os dois esconderia um horário de funcionamento que mudou.
  return achado ? (achado.disponivel ?? achado.livre ?? null) : null;
}

/** As horas livres do dia, para a falha dizer qual alternativa existe. */
async function livresDoDia(data) {
  const { dados } = await chamar(`/quadras/${QUADRA}/disponibilidade?data=${data}`);
  const slots = dados?.slots ?? comoLista(dados);
  return slots
    .filter((s) => (s.disponivel ?? s.livre) === true)
    .map((s) => String(s.inicio ?? "").slice(11, 16));
}

async function main() {
  const dia = amanha();
  console.log(`Ensaio do piloto (Instrumento III) · API ${API}`);
  console.log(`Quadra ${QUADRA} · amanhã é ${dia}\n`);

  const saude = await chamar("/quadras");
  if (saude.status !== 200) {
    console.error(
      saude.semResposta
        ? `A API não está no ar em ${API} (${saude.semResposta}).`
        : `A API respondeu ${saude.status} em ${API}, e não 200.`,
    );
    console.error(
      "\nSuba a API e carregue o seed antes:\n" +
        "  pnpm --filter @rally/api exec prisma db seed\n" +
        "  pnpm dev\n",
    );
    process.exit(2);
  }

  // T1 ─ o cadastro abre sessão?
  const email = `ensaio-${Date.now()}@teste.local`;
  const cadastro = await chamar("/auth/register", {
    metodo: "POST",
    corpo: {
      nome: "Ensaio do Piloto",
      email,
      senha: "SenhaDoEnsaio!2026",
      telefone: "51999990000",
      // Ver a armadilha 1 no cabeçalho deste arquivo.
      aceitouTermos: true,
    },
  });
  const token = cadastro.dados?.accessToken;
  if (!token) {
    falha("T1", `o cadastro não abriu sessão: ${JSON.stringify(cadastro.dados)}`);
    console.log("\nSem sessão não há como seguir: T3 a T6 dependem dela.");
    process.exit(1);
  }
  ok("T1", "o cadastro abre sessão, sem passo de verificação no caminho");

  // T2 ─ o filtro de modalidade devolve quadra?
  const filtro = new URLSearchParams({ modalidade: "Futevôlei" });
  const porModalidade = await chamar(`/quadras?${filtro}`);
  const quadras = comoLista(porModalidade.dados);
  if (quadras.length > 0) {
    ok("T2", `${quadras.length} quadra(s) de futevôlei pelo filtro`);
  } else {
    falha("T2", "o filtro de modalidade não devolveu quadra nenhuma");
  }

  // T3 ─ o horário que o roteiro pede está livre?
  const antes = await horarioLivre(dia, "19:00");
  if (antes !== true) {
    falha(
      "T3",
      antes === null
        ? `não há slot de 19:00 em ${dia} — confira o horário de funcionamento`
        : `19:00 de ${dia} já está ocupado antes do ensaio`,
    );
    // Quais horários **estão** livres, porque é a pergunta seguinte de quem
    // lê a falha. Um checkout abandonado prende o horário por
    // `pixExpiraMinutos` (30 por omissão) até o trabalho agendado o
    // liberar, de minuto a minuto — então "espere meia hora" costuma ser a
    // resposta, e mudar o horário do roteiro é a alternativa.
    console.log(`         livres em ${dia}: ${(await livresDoDia(dia)).join(", ") || "nenhum"}`);
  }

  const reserva = await chamar("/reservas", {
    metodo: "POST",
    token,
    corpo: {
      quadraId: QUADRA,
      inicio: `${dia}T19:00:00.000Z`,
      fim: `${dia}T20:00:00.000Z`,
      metodoPagamento: "PIX",
    },
  });
  const id = reserva.dados?.id;
  if (!id) {
    falha("T3", `a reserva não foi criada: ${JSON.stringify(reserva.dados)}`);
    console.log("\nSem reserva não há T4, T5 nem T6.");
    process.exit(1);
  }
  ok("T3", `reserva criada para 19:00 de ${dia}`);

  // T4 ─ o Pix devolve copia e cola?
  const pagamento = reserva.dados?.pagamento ?? {};
  if (pagamento.pixCopiaCola) {
    ok(
      "T4",
      `Pix ${pagamento.status} · copia e cola de ${pagamento.pixCopiaCola.length} caracteres`,
    );
  } else {
    falha("T4", "o pagamento veio sem copia e cola — a tela do QR fica vazia");
  }

  // T5 ─ a reserva aparece em "minhas reservas"?
  const minhas = await chamar("/reservas/minhas", { token });
  if (comoLista(minhas.dados).some((r) => r.id === id)) {
    ok("T5", "a reserva aparece em minhas reservas");
  } else {
    falha("T5", "a reserva não aparece na lista do cliente");
  }

  // T6 ─ o cancelamento é aceito?
  const cancelamento = await chamar(`/reservas/${id}/cancelar`, {
    metodo: "POST",
    token,
    corpo: { motivo: "ensaio do piloto" },
  });
  if (cancelamento.status < 300) {
    // A janela de `cancelamentoHoras` **não** decide se dá para cancelar, e
    // sim se é no prazo — então `dentroDoPrazo: false` não é falha da tarefa.
    ok("T6", `cancelada · dentroDoPrazo: ${cancelamento.dados?.dentroDoPrazo}`);
  } else {
    falha("T6", `o cancelamento foi recusado: ${JSON.stringify(cancelamento.dados)}`);
  }

  // E o horário volta a ficar livre, que é o que permite rodar na véspera.
  const depois = await horarioLivre(dia, "19:00");
  if (depois === true) {
    ok("--", `19:00 de ${dia} está livre de novo — o ensaio não deixou rastro`);
  } else {
    falha("--", `19:00 de ${dia} ficou ocupado pelo ensaio: cancele a reserva ${id} à mão`);
  }

  console.log(
    falhas === 0
      ? "\nAs seis tarefas têm a pré-condição atendida. O que falta é o aparelho e as pessoas."
      : `\n${falhas} pré-condição(ões) não atendida(s) — resolver antes da sessão.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

await main();
