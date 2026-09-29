// SPDX-License-Identifier: AGPL-3.0-or-later
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-label";

const duvidas = [
  {
    pergunta: "Como o jogador paga?",
    resposta:
      "Pelo Pix: o QR aparece na hora e a reserva é confirmada sozinha quando o pagamento cai, por webhook assinado do gateway (AbacatePay). Cartão fica como alternativa.",
  },
  {
    pergunta: "E se dois times pedirem o mesmo horário?",
    resposta:
      "Só um fecha. A trava é no banco de dados — um índice único por quadra e horário —, então nem duas pessoas clicando no mesmo segundo conseguem reservar o mesmo slot. O segundo recebe o horário de volta como indisponível.",
  },
  {
    pergunta: "Dá para cancelar ou remarcar?",
    resposta:
      "Dá. Você define a janela de cancelamento do seu espaço (por exemplo, até 12 horas antes) e o sistema aplica a política sozinho, liberando o horário para outra pessoa.",
  },
  {
    pergunta: "Preciso instalar alguma coisa?",
    resposta:
      "Não. A gestão roda no navegador, no computador ou no celular. Para quem joga existe também o app de iOS e Android.",
  },
  {
    pergunta: "Os replays já estão funcionando?",
    resposta:
      "Ainda não. O recorte em desenvolvimento entrega agenda, reserva e pagamento; os replays são a fase seguinte do roadmap, junto da captação em quadra.",
  },
  {
    pergunta: "O que acontece com os dados dos meus clientes?",
    resposta:
      "Coletamos o mínimo para a reserva funcionar, guardamos senha com argon2 e tudo trafega em TLS. Pela LGPD, o titular pode pedir exportação ou exclusão dos dados, atendidas em até 15 dias.",
  },
  {
    pergunta: "O Rally é open source mesmo?",
    resposta:
      "É. O código está no GitHub sob licença AGPL-3.0 — dá para ler, auditar e rodar por conta própria. O que se paga é a edição hospedada, com suporte e atualizações.",
  },
];

export function Faq() {
  const dadosEstruturados = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: duvidas.map((duvida) => ({
      "@type": "Question",
      name: duvida.pergunta,
      acceptedAnswer: { "@type": "Answer", text: duvida.resposta },
    })),
  };

  return (
    <section id="faq" aria-labelledby="titulo-faq" className="border-t border-line">
      <Container className="grid gap-12 py-20 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <SectionLabel index="07">Dúvidas</SectionLabel>
          <h2
            id="titulo-faq"
            className="mt-4 font-display text-[32px] font-bold leading-tight tracking-tight text-ink sm:text-[42px]"
          >
            Perguntas que sempre chegam.
          </h2>
        </div>

        <div className="lg:col-span-8">
          <div className="border-t border-line">
            {duvidas.map((duvida) => (
              <details key={duvida.pergunta} className="group border-b border-line">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-[17px] font-bold leading-snug text-ink [&::-webkit-details-marker]:hidden">
                  <span>{duvida.pergunta}</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-mono text-xl text-coral-deep transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-gray">
                  {duvida.resposta}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosEstruturados) }}
      />
    </section>
  );
}
